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
                activePattern: {
                    name: 'activePattern',
                    modifier: 'rw',
                    values: [{ key: 0, value: 'Test Pattern' }],
                    type: 'list',
                },
                patternStarted: {
                    name: 'patternStarted',
                    modifier: 'rw',
                    type: 'bool',
                    value: false,
                },
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
            .expect(202);

        expect(simulator.receivedCommands.map(c => c.type)).toContain('PatternStart');

        const resAfterPatch = await request(app.httpServer).get(`/device/${deviceId}`);
        expect(resAfterPatch.status).toBe(200);
        expect(resAfterPatch.body.attributes.patternStarted.value).toBe(true);

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
            .expect(202);

        const res = await request(app.httpServer).get(`/device/${deviceId}`);
        expect(res.status).toBe(200);

        const attrs = res.body.attributes;

        // Core pattern-state attributes remain present
        expect(attrs).toMatchObject({
            activePattern:  { name: 'activePattern',  modifier: 'rw', type: 'list',  value: 0 },
            patternStarted: { name: 'patternStarted', modifier: 'rw', type: 'bool',  value: true },
        });

        // Four power-channel range attributes are created (min=max=0, value not yet set by device)
        for (let ch = 1; ch <= 4; ch++) {
            expect(attrs[`powerChannel${ch}`]).toMatchObject({
                name: `powerChannel${ch}`,
                modifier: 'rw',
                type: 'range',
                min: 0,
                max: 0,
                incrementStep: 1,
            });
        }

        // MIN_MAX menu item (Id=1) → IntRangeDeviceAttribute initialised to Default value
        expect(attrs.patternAttribute1).toMatchObject({
            name: 'patternAttribute1',
            modifier: 'rw',
            type: 'range',
            min: 0,
            max: 100,
            incrementStep: 1,
            value: 50,
        });

        // MULTI_CHOICE menu item (Id=2) → ListDeviceAttribute initialised to Default choice
        expect(attrs.patternAttribute2).toMatchObject({
            name: 'patternAttribute2',
            modifier: 'rw',
            type: 'list',
            values: [
                { key: 0, value: 'Sine' },
                { key: 1, value: 'Square' },
            ],
            value: 0,
        });
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
            .expect(202);

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
            ([p]) => p.deviceId === deviceId && p.attributes?.powerChannel1?.value === 20,
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
                powerChannel1: { value: 20, max: 100 },
            },
        });

        const res = await request(app.httpServer).get(`/device/${deviceId}`);
        expect(res.status).toBe(200);

        const attrs = res.body.attributes;

        // Power channels carry the values broadcast in the PowerStatus message.
        expect(attrs.powerChannel1).toMatchObject({ value: 20, max: 100 });

        // Pattern-specific attributes are NOT part of the PowerStatus message:
        // they retain the initial values set when the pattern was started.
        expect(attrs.patternAttribute1).toMatchObject({ value: 50 });
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
