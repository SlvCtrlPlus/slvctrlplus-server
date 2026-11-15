import { afterAll, assert, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { io as ioClient } from 'socket.io-client';
import Zc95SerialDeviceProvider from '../../../src/device/protocol/zc95/zc95SerialDeviceProvider.js';
import WebSocketEvent from '../../../src/device/webSocketEvent.js';
import { Zc95DeviceSimulator } from '../helpers/zc95DeviceSimulator.js';
import { createTestApp, teardownTestApp, waitForNextWsEvent, createWsClient, TestApp } from '../helpers/appHelper.js';

process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';

const PORT_PATH = '/dev/test-zc95-0';

const SERIAL_SOURCE_ID = 'e6f7a8b9-6789-4321-abcd-ef1234567895';

const serialSettings = {
    knownDevices: {},
    deviceSources: {
        [SERIAL_SOURCE_ID]: {
            id: SERIAL_SOURCE_ID,
            type: Zc95SerialDeviceProvider.providerName,
            config: {},
        },
    },
};

describe('Zc95 serial device provider', () => {
    let app: TestApp;
    let wsEmitSpy: ReturnType<typeof vi.spyOn>;
    let wsClient: ReturnType<typeof ioClient>;

    beforeAll(async () => {
        app = await createTestApp(serialSettings);

        wsEmitSpy = vi.spyOn(app.websocket, 'emit');

        wsClient = await createWsClient(app.httpServer);
    });

    afterAll(async () => {
        wsClient.disconnect();
        await teardownTestApp(app);
        app.mockSerialPortFactory.reset();
    });

    beforeEach(async () => {
        await app.container.get('device.manager').reset();
        app.mockSerialPortFactory.reset();
        await app.container.get('device.observer.serial').discoverSerialDevices();
        wsEmitSpy.mockClear();
    });

    it('new device gets detected', async () => {
        const simulator = new Zc95DeviceSimulator();
        app.mockSerialPortFactory.attachDevice(PORT_PATH, simulator);

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);

        await app.container.get('device.observer.serial').discoverSerialDevices();

        const [payload] = await deviceConnected;

        const expectedDeviceObject = {
            provider: Zc95SerialDeviceProvider.providerName,
            type: 'zc95',
            attributes: {
                activePattern: 0,
                patternStarted: false,
            },
            attributesSchema: {
                anyOf: expect.arrayContaining([
                    expect.objectContaining({
                        type: 'object',
                        properties: expect.objectContaining({
                            activePattern: expect.objectContaining({ type: 'integer' }),
                            patternStarted: expect.objectContaining({ const: false }),
                        }),
                    }),
                ]),
            },
            config: {},
        };

        expect(payload).toMatchObject(expectedDeviceObject);

        // GET /device/:id should also return the same attributes
        const resSingleDevice = await request(app.httpServer).get(`/device/${payload.deviceId}`);
        expect(resSingleDevice.status).toBe(200);
        expect(resSingleDevice.body).toMatchObject(expectedDeviceObject);

        // GET /devices should list the device as well
        const resDeviceList = await request(app.httpServer).get('/devices');
        expect(resDeviceList.status).toBe(200);
        expect(resDeviceList.body.count).toBe(1);
        expect(resDeviceList.body.items[0]).toMatchObject(expectedDeviceObject);
    });

    it('attribute value can be set', async () => {
        const simulator = new Zc95DeviceSimulator();
        app.mockSerialPortFactory.attachDevice(PORT_PATH, simulator);

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        await app.container.get('device.observer.serial').discoverSerialDevices();
        const [payload] = await deviceConnected;

        const deviceId = payload.deviceId;

        // Set attribute value via REST API – setAttribute() calls updateLastRefresh() which emits deviceRefreshed
        await request(app.httpServer)
            .patch(`/device/${deviceId}`)
            .send({ patternStarted: true })
            .expect(200);

        expect(simulator.receivedCommands.map(c => c.type)).toContain('PatternStart');

        const resAfterPatch = await request(app.httpServer).get(`/device/${deviceId}`);
        expect(resAfterPatch.status).toBe(200);
        expect(resAfterPatch.body.attributes.patternStarted).toBe(true);

        // Set attribute value via WebSocket – setAttribute() also calls updateLastRefresh()
        // so we can wait for the resulting deviceRefreshed event.
        const deviceRefreshed = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceRefreshed);

        wsClient.emit(WebSocketEvent.deviceUpdateReceived, { deviceId, data: { patternStarted: false } });
        await deviceRefreshed;

        expect(simulator.receivedCommands.map(c => c.type)).toContain('PatternStop');
    });

    it('started pattern exposes power channel and pattern-specific attributes', async () => {
        const simulator = new Zc95DeviceSimulator({
            patterns: [
                {
                    id: 0,
                    name: 'Test Pattern',
                    menuItems: [
                        {
                            Id: 1,
                            Title: 'Intensity',
                            Group: 0,
                            Type: 'MIN_MAX',
                            Default: 50,
                            Min: 0,
                            Max: 100,
                            IncrementStep: 1,
                            UoM: '%',
                        },
                        {
                            Id: 2,
                            Title: 'Waveform',
                            Group: 0,
                            Type: 'MULTI_CHOICE',
                            Default: 0,
                            Choices: [
                                { Id: 0, Name: 'Sine' },
                                { Id: 1, Name: 'Square' },
                            ],
                        },
                    ],
                },
            ],
        });
        app.mockSerialPortFactory.attachDevice(PORT_PATH, simulator);

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        await app.container.get('device.observer.serial').discoverSerialDevices();
        const [payload] = await deviceConnected;

        const deviceId = payload.deviceId;

        await request(app.httpServer)
            .patch(`/device/${deviceId}`)
            .send({ patternStarted: true })
            .expect(200);

        const res = await request(app.httpServer).get(`/device/${deviceId}`);
        expect(res.status).toBe(200);

        const attrs = res.body.attributes;

        // Core pattern-state values
        expect(attrs).toMatchObject({
            activePattern: 0,
            patternStarted: true,
        });

        // Pattern attributes carry initial default values
        expect(attrs.patternAttributes).toMatchObject({ 1: 50, 2: 0 });

        // Power channels are not yet present — they are seeded on the first
        // PowerStatus broadcast from the firmware (see 'device refreshes' test).
        expect(attrs.powerChannels).toBeUndefined();

        // Schema describes the structure
        const schema = res.body.attributesSchema;
        expect(schema).toBeDefined();
    });

    it('device refreshes', async () => {
        // Use a pattern with real menu items so we can verify that the unsolicited
        // PowerStatus message only updates the power-channel attributes and leaves
        // the pattern-specific attributes untouched.
        const simulator = new Zc95DeviceSimulator({
            patterns: [
                {
                    id: 0,
                    name: 'Test Pattern',
                    menuItems: [
                        {
                            Id: 1,
                            Title: 'Intensity',
                            Group: 0,
                            Type: 'MIN_MAX',
                            Default: 50,
                            Min: 0,
                            Max: 100,
                            IncrementStep: 1,
                            UoM: '%',
                        },
                    ],
                },
            ],
        });
        app.mockSerialPortFactory.attachDevice(PORT_PATH, simulator);

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        await app.container.get('device.observer.serial').discoverSerialDevices();
        const [payload] = await deviceConnected;

        const deviceId = payload.deviceId;

        // Start the pattern so the powerChannel and patternAttribute attributes are created.
        await request(app.httpServer)
            .patch(`/device/${deviceId}`)
            .send({ patternStarted: true })
            .expect(200);

        // The ZC95 firmware periodically broadcasts unsolicited PowerStatus messages.
        // PowerStatusMsgResponse only carries Channels (Channel, OutputPower, MaxOutputPower,
        // PowerLimit). processPowerStatusMessage() updates powerChannel attributes and calls
        // updateLastRefresh(), which emits deviceRefreshed.
        // Raw values are converted via * 0.1:
        //   powerChannel1 value = Math.floor(200 * 0.1) = 20
        //   powerChannel1 max   = Math.floor(1000 * 0.1) = 100
        const deviceRefreshed = waitForNextWsEvent(
            wsEmitSpy,
            WebSocketEvent.deviceRefreshed,
            5000,
            ([p]) => {
                if (p.deviceId !== deviceId) return false;
                const channels = p.attributes['powerChannels'];
                if (typeof channels !== 'object' || channels === null) return false;
                return Reflect.get(channels, '1') === 20;
            },
        );

        simulator.sendPowerStatus([
            { channel: 1, outputPower: 200, maxOutputPower: 200, powerLimit: 1000 },
            { channel: 2, outputPower: 0,   maxOutputPower: 0,   powerLimit: 1000 },
            { channel: 3, outputPower: 0,   maxOutputPower: 0,   powerLimit: 1000 },
            { channel: 4, outputPower: 0,   maxOutputPower: 0,   powerLimit: 1000 },
        ]);

        const [refreshPayload] = await deviceRefreshed;

        // Power channels are updated by the PowerStatus message.
        expect(refreshPayload).toMatchObject({
            deviceId,
            attributes: {
                powerChannels: { 1: 20 },
            },
        });

        const res = await request(app.httpServer).get(`/device/${deviceId}`);
        expect(res.status).toBe(200);

        const attrs = res.body.attributes;

        // Power channels carry the values broadcast in the PowerStatus message.
        expect(attrs.powerChannels).toMatchObject({ 1: 20 });

        // Pattern-specific attributes are NOT part of the PowerStatus message:
        // they retain the initial values set when the pattern was started.
        expect(attrs.patternAttributes).toMatchObject({ 1: 50 });
    });

    it('device disconnected', async () => {
        const simulator = new Zc95DeviceSimulator();
        app.mockSerialPortFactory.attachDevice(PORT_PATH, simulator);

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        await app.container.get('device.observer.serial').discoverSerialDevices();
        const [payload] = await deviceConnected;

        const deviceId = payload.deviceId;

        const device = app.container.get('device.manager').getConnectedDevice(deviceId);
        assert(device !== null);

        const deviceDisconnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceDisconnected);
        await device.close();
        const [disconnectPayload] = await deviceDisconnected;

        expect(disconnectPayload).toMatchObject({ deviceId });

        const res = await request(app.httpServer).get('/devices');
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBe(0);
    });
});
