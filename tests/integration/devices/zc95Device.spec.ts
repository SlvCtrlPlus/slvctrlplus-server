import { afterAll, assert, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { io as ioClient } from 'socket.io-client';
import { AppInstance } from '../../../src/app.js';
import Zc95SerialDeviceProvider from '../../../src/device/protocol/zc95/zc95SerialDeviceProvider.js';
import WebSocketEvent from '../../../src/device/webSocketEvent.js';
import { Zc95DeviceSimulator } from '../helpers/zc95DeviceSimulator.js';
import { createTestApp, teardownTestApp, waitForNextWsEvent, createWsClient } from '../helpers/appHelper.js';
import ServiceMap from '../../../src/serviceMap.js';
import { Container } from '@timesplinter/pimple';
import MockSerialPortFactory from '../helpers/mockSerialPortFactory.js';
import http from 'http';

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
    let app: AppInstance;
    let httpServer: http.Server;
    let container: Container<ServiceMap>;
    let tmpDir: string;
    let wsEmitSpy: ReturnType<typeof vi.spyOn>;
    let wsClient: ReturnType<typeof ioClient>;
    let mockSerialPortFactory: MockSerialPortFactory;

    beforeAll(async () => {
        ({ app, container, tmpDir, mockSerialPortFactory, httpServer } = await createTestApp(serialSettings));

        wsEmitSpy = vi.spyOn(app.websocket, 'emit');

        wsClient = await createWsClient(httpServer);
    });

    afterAll(async () => {
        wsClient.disconnect();
        await teardownTestApp(app, container, tmpDir, httpServer);
        mockSerialPortFactory.reset();
    });

    beforeEach(async () => {
        await container.get('device.manager').reset();
        mockSerialPortFactory.reset();
        await container.get('device.observer.serial').discoverSerialDevices();
        wsEmitSpy.mockClear();
    });

    it('new device gets detected', async () => {
        const simulator = new Zc95DeviceSimulator();
        mockSerialPortFactory.attachDevice(PORT_PATH, simulator);

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);

        await container.get('device.observer.serial').discoverSerialDevices();

        const payload = await deviceConnected;

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

        assert(typeof payload === 'object' && payload !== null && 'deviceId' in payload);

        // GET /device/:id should also return the same attributes
        const resSingleDevice = await request(httpServer).get(`/device/${payload.deviceId}`);
        expect(resSingleDevice.status).toBe(200);
        expect(resSingleDevice.body).toMatchObject(expectedDeviceObject);

        // GET /devices should list the device as well
        const resDeviceList = await request(httpServer).get('/devices');
        expect(resDeviceList.status).toBe(200);
        expect(resDeviceList.body.count).toBe(1);
        expect(resDeviceList.body.items[0]).toMatchObject(expectedDeviceObject);
    });

    it('attribute value can be set', async () => {
        const simulator = new Zc95DeviceSimulator();
        mockSerialPortFactory.attachDevice(PORT_PATH, simulator);

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        await container.get('device.observer.serial').discoverSerialDevices();
        const payload = await deviceConnected;

        assert(typeof payload === 'object' && payload !== null && 'deviceId' in payload);
        const deviceId = payload.deviceId;
        assert(typeof deviceId === 'string');

        // Set attribute value via REST API – setAttribute() calls updateLastRefresh() which emits deviceRefreshed
        await request(httpServer)
            .patch(`/device/${deviceId}`)
            .send({ patternStarted: true })
            .expect(202);

        expect(simulator.receivedCommands.map(c => c.type)).toContain('PatternStart');

        const resAfterPatch = await request(httpServer).get(`/device/${deviceId}`);
        expect(resAfterPatch.status).toBe(200);
        expect(resAfterPatch.body.attributes.patternStarted.value).toBe(true);

        // Set attribute value via WebSocket – setAttribute() also calls updateLastRefresh()
        // so we can wait for the resulting deviceRefreshed event.
        const deviceRefreshed = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceRefreshed);

        wsClient.emit(WebSocketEvent.deviceUpdateReceived, { deviceId, data: { patternStarted: false } });
        await deviceRefreshed;

        expect(simulator.receivedCommands.map(c => c.type)).toContain('PatternStop');
    });

    it('device refreshes', async () => {
        const simulator = new Zc95DeviceSimulator();
        mockSerialPortFactory.attachDevice(PORT_PATH, simulator);

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        await container.get('device.observer.serial').discoverSerialDevices();
        const payload = await deviceConnected;

        assert(typeof payload === 'object' && payload !== null && 'deviceId' in payload);
        const deviceId = payload.deviceId;
        assert(typeof deviceId === 'string');

        // Start a pattern first so that the powerChannel attributes are created.
        // They are only instantiated inside setAttributePatternStarted(true).
        await request(httpServer)
            .patch(`/device/${deviceId}`)
            .send({ patternStarted: true })
            .expect(202);

        // The ZC95 firmware periodically broadcasts unsolicited PowerStatus messages.
        // The device handles them in processPowerStatusMessage() (MsgId === -1, Type === 'PowerStatus'),
        // updates the powerChannel attributes and calls updateLastRefresh(), which emits deviceRefreshed.
        // PowerStatus values are raw (0–1000); the device converts via * 0.1.
        //   powerChannel1 value  = Math.floor(200 * 0.1) = 20
        //   powerChannel1 max    = Math.floor(1000 * 0.1) = 100
        const deviceRefreshed = waitForNextWsEvent(
            wsEmitSpy,
            WebSocketEvent.deviceRefreshed,
            5000,
            (p) => {
                if (typeof p !== 'object' || p === null || !('deviceId' in p) || !('attributes' in p)) return false;
                const pObj = p as { deviceId: unknown; attributes: { powerChannel1?: { value?: unknown } } };
                return pObj.deviceId === deviceId && pObj.attributes?.powerChannel1?.value === 20;
            },
        );

        simulator.sendPowerStatus([
            { channel: 1, outputPower: 200, maxOutputPower: 200, powerLimit: 1000 },
            { channel: 2, outputPower: 0,   maxOutputPower: 0,   powerLimit: 1000 },
            { channel: 3, outputPower: 0,   maxOutputPower: 0,   powerLimit: 1000 },
            { channel: 4, outputPower: 0,   maxOutputPower: 0,   powerLimit: 1000 },
        ]);

        const refreshPayload = await deviceRefreshed;

        const expectedPayload = {
            deviceId,
            attributes: {
                powerChannel1: { value: 20 },
            },
        };

        expect(refreshPayload).toMatchObject(expectedPayload);

        const res = await request(httpServer).get(`/device/${deviceId}`);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject(expectedPayload);
    });

    it('device disconnected', async () => {
        const simulator = new Zc95DeviceSimulator();
        mockSerialPortFactory.attachDevice(PORT_PATH, simulator);

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        await container.get('device.observer.serial').discoverSerialDevices();
        const payload = await deviceConnected;

        assert(typeof payload === 'object' && payload !== null && 'deviceId' in payload);
        const deviceId = payload.deviceId;
        assert(typeof deviceId === 'string');

        const device = container.get('device.manager').getConnectedDevice(deviceId);
        assert(device !== null);

        const deviceDisconnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceDisconnected);
        await device.close();
        const disconnectPayload = await deviceDisconnected;

        expect(disconnectPayload).toMatchObject({ deviceId });

        const res = await request(httpServer).get('/devices');
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBe(0);
    });
});
