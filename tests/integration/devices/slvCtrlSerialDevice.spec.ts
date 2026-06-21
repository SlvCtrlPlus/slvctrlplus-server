import { afterAll, afterEach, assert, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { io as ioClient } from 'socket.io-client';
import { AppInstance } from '../../../src/app.js';
import SlvCtrlPlusSerialDeviceProvider from '../../../src/device/protocol/slvCtrlPlus/slvCtrlPlusSerialDeviceProvider.js';
import WebSocketEvent from '../../../src/device/webSocketEvent.js';
import { SlvCtrlPlusDeviceSimulator } from '../helpers/slvCtrlPlusDeviceSimulator.js';
import { createTestApp, teardownTestApp, waitForNextWsEvent, getConnectedDevice, getServerPort } from '../helpers/appHelper.js';
import ServiceMap from '../../../src/serviceMap.js';
import { Container } from '@timesplinter/pimple';
import MockSerialPortFactory from '../helpers/mockSerialPortFactory.js';
import Device from '../../../src/device/device.js';
import http from 'http';

process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';

const V1_PORT_PATH     = '/dev/test-slvctrl-v1-0';
const LEGACY_PORT_PATH = '/dev/test-slvctrl-legacy-0';

const SERIAL_SOURCE_ID = 'e6f7a8b9-6789-4321-abcd-ef1234567895';

const serialSettings = {
    knownDevices: {},
    deviceSources: {
        [SERIAL_SOURCE_ID]: {
            id: SERIAL_SOURCE_ID,
            type: SlvCtrlPlusSerialDeviceProvider.providerName,
            config: {},
        },
    },
};

describe('SlvCtrl serial device provider', () => {
    let app: AppInstance;
    let server: http.Server;
    let container: Container<ServiceMap>;
    let tmpDir: string;
    let wsEmitSpy: ReturnType<typeof vi.spyOn>;
    let wsClient: ReturnType<typeof ioClient>;
    let mockSerialPortFactory: MockSerialPortFactory;
    let v1Simulator: SlvCtrlPlusDeviceSimulator;
    let legacySimulator: SlvCtrlPlusDeviceSimulator;

    beforeAll(async () => {
        ({ app, container, tmpDir, mockSerialPortFactory } = await createTestApp(serialSettings));

        wsEmitSpy = vi.spyOn(app.websocket, 'emit');

        server = app.serve(0).httpServer;
        wsClient = ioClient(`http://localhost:${getServerPort(server)}`);

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Failed to connect WebSocket client')), 2000);
            wsClient.on('connect', () => { clearTimeout(timeout); resolve(); });
            wsClient.on('connect_error', reject);
        });
    });

    afterAll(async () => {
        await teardownTestApp(app, container, tmpDir);
        mockSerialPortFactory.reset();
    });

    afterEach(async () => {
        // Close all connected devices before destroying the mock binding so their polling
        // timers are stopped and the device-close chain completes cleanly. Without this,
        // stale devices accumulate across test iterations: each one keeps a 100ms polling
        // timer alive and floods the event loop with I/O errors after the binding is torn down.
        await container.get('device.manager').reset();
        mockSerialPortFactory.reset();
        await container.get('device.observer.serial').discoverSerialDevices();
        wsEmitSpy.mockClear();
    });

    it.each([
        { protocol: 'legacy', deviceType: 'testDeviceLegacy' },
        { protocol: 'v1',  deviceType: 'testDeviceV1' },
    ] as const)('new $protocol device gets detected', async ({ protocol, deviceType }) => {
        const portPath = protocol === 'v1' ? V1_PORT_PATH : LEGACY_PORT_PATH;
        const simulator = new SlvCtrlPlusDeviceSimulator({ protocol, deviceType });
        mockSerialPortFactory.attachDevice(portPath, simulator);

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);

        await container.get('device.observer.serial').discoverSerialDevices();

        const payload = await deviceConnected;
        
        const expectedDeviceObject = {
            provider: SlvCtrlPlusSerialDeviceProvider.providerName,
            type: 'slvCtrlPlus',
            attributes: {
                connected: {
                    name: 'connected',
                    modifier: 'ro',
                    type: 'bool'
                },
                enabled: {
                    name: 'enabled',
                    modifier: 'rw',
                    type: 'bool'
                },
                counter: {
                    name: 'counter',
                    modifier: 'ro',
                    type: 'int'
                },
                level: {
                    name: 'level',
                    modifier: 'rw',
                    type: 'int'
                },
                temperature: {
                    name: 'temperature',
                    modifier: 'ro',
                    type: 'float'
                },
                gain: {
                    name: 'gain',
                    modifier: 'rw',
                    type: 'float'
                },
                label: {
                    name: 'label',
                    modifier: 'ro',
                    type: 'str'
                },
                mode: {
                    name: 'mode',
                    modifier: 'rw',
                    type: 'str'
                },
                intensity: {
                    name: 'intensity',
                    modifier: 'rw',
                    min: 0,
                    max: 100,
                    incrementStep: 1,
                    type: 'range'
                },
                preset: {
                    name: 'preset',
                    modifier: 'rw',
                    values: [
                        {
                            "key": "low",
                            "value": "low",
                        },
                        {
                            "key": "medium",
                            "value": "medium",
                        },
                        {
                            "key": "high",
                            "value": "high",
                        }
                    ],
                    type: 'list'
                },
                channel: {
                    name: 'channel',
                    modifier: 'rw',
                    values: [
                         {
                            "key": (protocol === 'legacy') ? "1" : 1,
                            "value": (protocol === 'legacy') ? "1" : 1,
                        },
                        {
                            "key": (protocol === 'legacy') ? "2" : 2,
                            "value": (protocol === 'legacy') ? "2" : 2,
                        },
                        {
                            "key": (protocol === 'legacy') ? "3" : 3,
                            "value": (protocol === 'legacy') ? "3" : 3,
                        }
                    ],
                    type: 'list'
                }
            },
            config: {},
            deviceModel: deviceType,
            fwVersion: 1,
        };

        expect(payload).toMatchObject(expectedDeviceObject);

        assert(typeof payload === 'object' && payload !== null && 'deviceId' in payload);

        // GET /device/:id should also return the same attributes
        const resSingleDevice = await request(server).get(`/device/${payload.deviceId}`);
        expect(resSingleDevice.status).toBe(200);
        expect(resSingleDevice.body).toMatchObject(expectedDeviceObject);

        // GET /devices should list the device as well and return the same attributes for it
        const resDeviceList = await request(server).get('/devices');
        expect(resDeviceList.status).toBe(200);

        expect(resDeviceList.body.count).toBe(1);
        expect(resDeviceList.body.items[0]).toMatchObject(expectedDeviceObject);
    });

    it.each([
        { protocol: 'legacy', deviceType: 'testDeviceLegacy' },
        { protocol: 'v1',  deviceType: 'testDeviceV1' },
    ] as const)('$protocol attribute value can be set', async ({ protocol, deviceType }) => {
        const portPath = protocol === 'v1' ? V1_PORT_PATH : LEGACY_PORT_PATH;
        const simulator = new SlvCtrlPlusDeviceSimulator({ protocol, deviceType });
        mockSerialPortFactory.attachDevice(portPath, simulator);

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        await container.get('device.observer.serial').discoverSerialDevices();
        const payload = await deviceConnected;

        assert(typeof payload === 'object' && payload !== null && 'deviceId' in payload);
        const deviceId = payload.deviceId;
        assert(typeof deviceId === 'string');

        // Set attribute value via REST API
        await request(server)
            .patch(`/device/${deviceId}`)
            .send({ level: 7 })
            .expect(202);

        expect(simulator.getValue('level')).toBe('7');

        const resAfterPatch = await request(server).get(`/device/${deviceId}`);
        expect(resAfterPatch.status).toBe(200);
        expect(resAfterPatch.body.attributes.level.value).toBe(7);

        // Set attribute value via Websocket
        const deviceRefreshed = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceRefreshed);

        wsClient.emit(WebSocketEvent.deviceUpdateReceived, { deviceId, data: { level: 9 } });
        await deviceRefreshed;

        expect(simulator.getValue('level')).toBe('9');
    });

    it.each([
        { protocol: 'legacy', deviceType: 'testDeviceLegacy' },
        { protocol: 'v1',  deviceType: 'testDeviceV1' },
    ] as const)('$protocol device refreshes', async ({ protocol, deviceType }) => {
        const portPath = protocol === 'v1' ? V1_PORT_PATH : LEGACY_PORT_PATH;
        const simulator = new SlvCtrlPlusDeviceSimulator({ protocol, deviceType });
        mockSerialPortFactory.attachDevice(portPath, simulator);

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        await container.get('device.observer.serial').discoverSerialDevices();
        const payload = await deviceConnected;

        assert(typeof payload === 'object' && payload !== null && 'deviceId' in payload);
        const deviceId = payload.deviceId;
        assert(typeof deviceId === 'string');

        const deviceRefreshed = waitForNextWsEvent(
            wsEmitSpy,
            WebSocketEvent.deviceRefreshed,
            5000,
            (p) => {
                if (typeof p !== 'object' || p === null || !('deviceId' in p) || !('attributes' in p)) return false;
                const pObj = p as { deviceId: unknown; attributes: { level?: { value?: unknown }; enabled?: { value?: unknown } } };
                return pObj.deviceId === deviceId
                    && pObj.attributes?.level?.value === 8
                    && pObj.attributes?.enabled?.value === true;
            },
        );

        simulator.setValue('level', '8');
        simulator.setValue('enabled', '1');

        const refreshPayload = await deviceRefreshed;

        const expectedPayload = {
            deviceId,
            attributes: {
                level: { value: 8 },
                enabled: { value: true },
            },
        };

        expect(refreshPayload).toMatchObject(expectedPayload);

        const res = await request(server).get(`/device/${deviceId}`);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject(expectedPayload);
    });

    it.each([
        { protocol: 'legacy', deviceType: 'testDeviceLegacy' },
        { protocol: 'v1',  deviceType: 'testDeviceV1' },
    ] as const)('$protocol device disconnected', async ({ protocol, deviceType }) => {
        const portPath = protocol === 'v1' ? V1_PORT_PATH : LEGACY_PORT_PATH;
        const simulator = new SlvCtrlPlusDeviceSimulator({ protocol, deviceType });
        mockSerialPortFactory.attachDevice(portPath, simulator);

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        await container.get('device.observer.serial').discoverSerialDevices();
        const payload = await deviceConnected;

        assert(typeof payload === 'object' && payload !== null && 'deviceId' in payload);
        const deviceId = payload.deviceId;
        assert(typeof deviceId === 'string');

        // Get device by its specific ID to avoid ambiguity with stale devices
        const device = container.get('device.manager').getConnectedDevice(deviceId);
        assert(device !== null);

        // Closing the MockPortBinding via simulator.disconnect() does not propagate a 'close' event
        // to the SerialPortStream reliably. Call device.close() directly instead, which is the
        // correct way to trigger the device lifecycle events (same as a real port close).
        const deviceDisconnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceDisconnected);
        await device.close();
        const disconnectPayload = await deviceDisconnected;

        expect(disconnectPayload).toMatchObject({ deviceId });

        // The specific device must no longer appear in the device list
        const res = await request(server).get('/devices');
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBe(0);
    });
});
