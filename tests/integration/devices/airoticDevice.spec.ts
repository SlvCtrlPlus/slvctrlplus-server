import { afterAll, assert, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { io as ioClient } from 'socket.io-client';
import AiroticDeviceProvider from '../../../src/device/protocol/airotic/airoticDeviceProvider.js';
import WebSocketEvent from '../../../src/device/webSocketEvent.js';
import { AiroticDeviceSimulator, mockNoble } from '../helpers/airoticDeviceSimulator.js';
import { createTestApp, teardownTestApp, waitForNextWsEvent, createWsClient, TestApp } from '../helpers/appHelper.js';

// ---------------------------------------------------------------------------
// Mock the noble singleton before any app code imports it.
// All modules that `import noble from '@stoprocent/noble'` will receive
// mockNoble, which is a controllable EventEmitter with stub scanning methods.
// ---------------------------------------------------------------------------
vi.mock('@stoprocent/noble', () => ({ default: mockNoble }));

process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';

const DEVICE_ID   = 'aa:bb:cc:dd:ee:ff';
const DEVICE_NAME = 'Airotic Test Bottle';

const BLE_SOURCE_ID = 'f1e2d3c4-b5a6-4789-abcd-ef1234567896';

const bleSettings = {
    knownDevices: {},
    deviceSources: {
        [BLE_SOURCE_ID]: {
            id: BLE_SOURCE_ID,
            type: AiroticDeviceProvider.providerName,
            config: {},
        },
    },
};

describe('Airotic BLE device provider', () => {
    let app: TestApp;
    let wsEmitSpy: ReturnType<typeof vi.spyOn>;
    let wsClient: ReturnType<typeof ioClient>;

    beforeAll(async () => {
        app = await createTestApp(bleSettings);

        wsEmitSpy = vi.spyOn(app.websocket, 'emit');

        wsClient = await createWsClient(app.httpServer);
    });

    afterAll(async () => {
        wsClient.disconnect();
        await teardownTestApp(app);
    });

    beforeEach(async () => {
        await app.container.get('device.manager').reset();
        wsEmitSpy.mockClear();
    });

    it('new device gets detected after BLE discovery', async () => {
        const simulator = new AiroticDeviceSimulator(DEVICE_ID, DEVICE_NAME);
        const peripheral = simulator.getPeripheral();

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);

        // Simulate the BLE adapter discovering the peripheral
        mockNoble.discoverPeripheral(peripheral);

        const [payload] = await deviceConnected;

        const expectedDeviceObject = {
            provider: AiroticDeviceProvider.providerName,
            type: 'airotic',
            attributes: {
                restColor: {
                    name: 'restColor',
                    modifier: 'rw',
                    type: 'str',
                },
                breathInColor: {
                    name: 'breathInColor',
                    modifier: 'rw',
                    type: 'str',
                },
                resetColors: {
                    name: 'resetColors',
                    modifier: 'wo',
                    type: 'bool',
                },
                reboot: {
                    name: 'reboot',
                    modifier: 'wo',
                    type: 'bool',
                },
                breathsPerMin: {
                    name: 'breathsPerMin',
                    modifier: 'ro',
                    type: 'float',
                },
                bpmTrend: {
                    name: 'bpmTrend',
                    modifier: 'ro',
                    type: 'str',
                },
            },
            config: {},
        };

        expect(payload).toMatchObject(expectedDeviceObject);

        // GET /device/:id must return the same attributes
        const resSingleDevice = await request(app.httpServer).get(`/device/${payload.deviceId}`);
        expect(resSingleDevice.status).toBe(200);
        expect(resSingleDevice.body).toMatchObject(expectedDeviceObject);

        // GET /devices must list the device
        const resDeviceList = await request(app.httpServer).get('/devices');
        expect(resDeviceList.status).toBe(200);
        expect(resDeviceList.body.count).toBe(1);
        expect(resDeviceList.body.items[0]).toMatchObject(expectedDeviceObject);
    });

    it('restColor attribute value can be set via REST', async () => {
        const simulator = new AiroticDeviceSimulator(DEVICE_ID, DEVICE_NAME);
        const peripheral = simulator.getPeripheral();

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        mockNoble.discoverPeripheral(peripheral);
        const [payload] = await deviceConnected;

        const deviceId = payload.deviceId;

        await request(app.httpServer)
            .patch(`/device/${deviceId}`)
            .send({ restColor: '255,0,128' })
            .expect(202);

        const commands = simulator.getWrittenCommands();

        // First command: select rest color slot (!B1)
        expect(commands.some(c => c.equals(Buffer.from('!B1', 'utf-8')))).toBe(true);
        // Second command: set color bytes (!C + RGB)
        const expectedColorCmd = Buffer.concat([Buffer.from('!C', 'utf-8'), Buffer.from([255, 0, 128])]);
        expect(commands.some(c => c.equals(expectedColorCmd))).toBe(true);

        // Attribute value persisted in REST response
        const res = await request(app.httpServer).get(`/device/${deviceId}`);
        expect(res.status).toBe(200);
        expect(res.body.attributes.restColor.value).toBe('255,0,128');
    });

    it('restColor attribute value can be set via WebSocket', async () => {
        const simulator = new AiroticDeviceSimulator(DEVICE_ID, DEVICE_NAME);
        const peripheral = simulator.getPeripheral();

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        mockNoble.discoverPeripheral(peripheral);
        const [payload] = await deviceConnected;

        const deviceId = payload.deviceId;

        // Emit the WS update and wait for the server-side async handler to complete.
        // AiroticDevice.setAttribute does not call updateLastRefresh(), so no deviceRefreshed
        // WS event is emitted immediately after a set. Instead we poll the REST endpoint
        // until the attribute value is reflected.
        wsClient.emit(WebSocketEvent.deviceUpdateReceived, { deviceId, data: { restColor: '0,255,0' } });

        await vi.waitFor(async () => {
            const res = await request(app.httpServer).get(`/device/${deviceId}`);
            expect(res.body.attributes.restColor.value).toBe('0,255,0');
        }, { timeout: 3000, interval: 50 });

        const commands = simulator.getWrittenCommands();
        expect(commands.some(c => c.equals(Buffer.from('!B1', 'utf-8')))).toBe(true);
        const expectedColorCmd = Buffer.concat([Buffer.from('!C', 'utf-8'), Buffer.from([0, 255, 0])]);
        expect(commands.some(c => c.equals(expectedColorCmd))).toBe(true);
    });

    it('breathInColor attribute value can be set via REST', async () => {
        const simulator = new AiroticDeviceSimulator(DEVICE_ID, DEVICE_NAME);
        const peripheral = simulator.getPeripheral();

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        mockNoble.discoverPeripheral(peripheral);
        const [payload] = await deviceConnected;

        const deviceId = payload.deviceId;

        await request(app.httpServer)
            .patch(`/device/${deviceId}`)
            .send({ breathInColor: '0,0,200' })
            .expect(202);

        const commands = simulator.getWrittenCommands();

        // Select breath-in color slot (!B2)
        expect(commands.some(c => c.equals(Buffer.from('!B2', 'utf-8')))).toBe(true);
        const expectedColorCmd = Buffer.concat([Buffer.from('!C', 'utf-8'), Buffer.from([0, 0, 200])]);
        expect(commands.some(c => c.equals(expectedColorCmd))).toBe(true);

        const res = await request(app.httpServer).get(`/device/${deviceId}`);
        expect(res.status).toBe(200);
        expect(res.body.attributes.breathInColor.value).toBe('0,0,200');
    });

    it('device refreshes when breath-in notification received', async () => {
        const simulator = new AiroticDeviceSimulator(DEVICE_ID, DEVICE_NAME);
        const peripheral = simulator.getPeripheral();

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        mockNoble.discoverPeripheral(peripheral);
        const [payload] = await deviceConnected;

        const deviceId = payload.deviceId;

        const deviceRefreshed = waitForNextWsEvent(
            wsEmitSpy,
            WebSocketEvent.deviceRefreshed,
            5000,
            ([p]) => p.deviceId === deviceId,
        );

        // Simulate two breaths (need ≥2 timestamps to compute BPM)
        simulator.sendBreathIn();
        await new Promise(r => setTimeout(r, 50));
        simulator.sendBreathIn();

        await deviceRefreshed;

        const res = await request(app.httpServer).get(`/device/${deviceId}`);
        expect(res.status).toBe(200);
        // After ≥2 breaths the breathsPerMin attribute should be set
        expect(res.body.attributes.breathsPerMin.value).toBeTypeOf('number');
    });

    it('device disconnected removes it from device list', async () => {
        const simulator = new AiroticDeviceSimulator(DEVICE_ID, DEVICE_NAME);
        const peripheral = simulator.getPeripheral();

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        mockNoble.discoverPeripheral(peripheral);
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
