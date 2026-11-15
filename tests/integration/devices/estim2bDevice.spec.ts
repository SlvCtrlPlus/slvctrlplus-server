import { afterAll, assert, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { io as ioClient } from 'socket.io-client';
import EStim2bSerialDeviceProvider from '../../../src/device/protocol/estim2b/estim2bSerialDeviceProvider.js';
import WebSocketEvent from '../../../src/device/webSocketEvent.js';
import { Estim2bDeviceSimulator } from '../helpers/estim2bDeviceSimulator.js';
import { createTestApp, teardownTestApp, waitForNextWsEvent, createWsClient, TestApp } from '../helpers/appHelper.js';

process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';

const PORT_PATH = '/dev/test-estim2b-0';

const SERIAL_SOURCE_ID = 'e6f7a8b9-6789-4321-abcd-ef1234567895';

const serialSettings = {
    knownDevices: {},
    deviceSources: {
        [SERIAL_SOURCE_ID]: {
            id: SERIAL_SOURCE_ID,
            type: EStim2bSerialDeviceProvider.providerName,
            config: {},
        },
    },
};

describe('E-Stim Systems 2B serial device provider', () => {
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
        const simulator = new Estim2bDeviceSimulator();
        app.mockSerialPortFactory.attachDevice(PORT_PATH, simulator);

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);

        await app.container.get('device.observer.serial').discoverSerialDevices();

        const [payload] = await deviceConnected;

        const expectedDeviceObject = {
            provider: EStim2bSerialDeviceProvider.providerName,
            type: 'estim2b',
            attributesSchema: {
                type: 'object',
                properties: {
                    mode: { type: 'integer' },
                    channelALevel: { type: 'integer', minimum: 0, maximum: 100 },
                    channelBLevel: { type: 'integer', minimum: 0, maximum: 100 },
                    highPowerMode: { type: 'boolean' },
                    channelsJoined: { type: 'boolean', readOnly: true },
                    batteryStatus: { type: 'string', readOnly: true },
                    pulseFrequency: { type: 'integer', minimum: 2, maximum: 100 },
                    pulsePwm: { type: 'integer', minimum: 2, maximum: 100 },
                },
            },
            config: {},
        };

        expect(payload).toMatchObject(expectedDeviceObject);

        const resSingleDevice = await request(app.httpServer).get(`/device/${payload.deviceId}`);
        expect(resSingleDevice.status).toBe(200);
        expect(resSingleDevice.body).toMatchObject(expectedDeviceObject);

        const resDeviceList = await request(app.httpServer).get('/devices');
        expect(resDeviceList.status).toBe(200);
        expect(resDeviceList.body.count).toBe(1);
        expect(resDeviceList.body.items[0]).toMatchObject(expectedDeviceObject);
    });

    it('attribute value can be set', async () => {
        const simulator = new Estim2bDeviceSimulator();
        app.mockSerialPortFactory.attachDevice(PORT_PATH, simulator);

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        await app.container.get('device.observer.serial').discoverSerialDevices();
        const [payload] = await deviceConnected;

        const deviceId = payload.deviceId;

        await request(app.httpServer)
            .patch(`/device/${deviceId}`)
            .send({ channelALevel: 50 })
            .expect(200);

        expect(simulator.receivedCommands).toContain('A50');

        const resAfterPatch = await request(app.httpServer).get(`/device/${deviceId}`);
        expect(resAfterPatch.status).toBe(200);
        expect(resAfterPatch.body.attributes.channelALevel).toBe(50);

        const deviceRefreshed = waitForNextWsEvent(
            wsEmitSpy,
            WebSocketEvent.deviceRefreshed,
            5000,
            ([device]) => device.attributes.channelALevel === 80,
        );

        wsClient.emit(WebSocketEvent.deviceUpdateReceived, { deviceId, data: { channelALevel: 80 } });
        await deviceRefreshed;

        expect(simulator.receivedCommands).toContain('A80');
    });

    it('device refreshes', async () => {
        const simulator = new Estim2bDeviceSimulator();
        app.mockSerialPortFactory.attachDevice(PORT_PATH, simulator);

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        await app.container.get('device.observer.serial').discoverSerialDevices();
        const [payload] = await deviceConnected;

        const deviceId = payload.deviceId;

        const deviceRefreshed = waitForNextWsEvent(
            wsEmitSpy,
            WebSocketEvent.deviceRefreshed,
            5000,
            ([p]) => p.deviceId === deviceId
                && p.attributes?.channelALevel === 80
                && p.attributes?.highPowerMode === true,
        );

        simulator.setChannelALevel(80);

        const [refreshPayload] = await deviceRefreshed;

        const expectedPayload = {
            deviceId,
            attributes: {
                channelALevel: 80,
                highPowerMode: true,
            },
        };

        expect(refreshPayload).toMatchObject(expectedPayload);

        const res = await request(app.httpServer).get(`/device/${deviceId}`);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject(expectedPayload);
    });

    it('device disconnected', async () => {
        const simulator = new Estim2bDeviceSimulator();
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
