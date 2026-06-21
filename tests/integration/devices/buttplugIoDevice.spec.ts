import { afterAll, afterEach, assert, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { io as ioClient } from 'socket.io-client';
import { Container } from '@timesplinter/pimple';
import http from 'http';
import { AppInstance } from '../../../src/app.js';
import WebSocketEvent from '../../../src/device/webSocketEvent.js';
import { DeviceAttributeModifier } from '../../../src/device/attribute/deviceAttribute.js';
import { ButtplugIoServerSimulator } from '../helpers/buttplugIoServerSimulator.js';
import { createTestApp, teardownTestApp, waitForNextWsEvent, getServerPort } from '../helpers/appHelper.js';
import ServiceMap from '../../../src/serviceMap.js';
import ButtplugIoWebsocketDeviceProvider from '../../../src/device/protocol/buttplugIo/buttplugIoWebsocketDeviceProvider.js';

const BUTTPLUG_SOURCE_ID = 'd5e6f7a8-5678-4321-abcd-ef1234567894';

function makeButtplugSettings(port: number): object {
    return {
        knownDevices: {},
        deviceSources: {
            [BUTTPLUG_SOURCE_ID]: {
                id: BUTTPLUG_SOURCE_ID,
                type: ButtplugIoWebsocketDeviceProvider.providerName,
                config: {
                    address: `127.0.0.1:${port}`,
                    autoScan: false,
                    useDeviceNameAsId: true,
                },
            },
        },
    };
}

describe('Buttplug.io device lifecycle', () => {
    let simulator: ButtplugIoServerSimulator;
    let app: AppInstance;
    let server: http.Server;
    let container: Container<ServiceMap>;
    let tmpDir: string;
    let wsEmitSpy: ReturnType<typeof vi.spyOn>;
    let wsClient: ReturnType<typeof ioClient>;

    beforeAll(async () => {
        simulator = new ButtplugIoServerSimulator();
        const simulatorPort = await simulator.start();

        ({ app, container, tmpDir } = await createTestApp(makeButtplugSettings(simulatorPort)));

        wsEmitSpy = vi.spyOn(app.websocket, 'emit');

        await simulator.waitForClientReady();

        server = app.serve(0).httpServer;
        wsClient = ioClient(`http://localhost:${getServerPort(server)}`);

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Failed to connect WebSocket client')), 2000);
            wsClient.on('connect', () => { clearTimeout(timeout); resolve(); });
            wsClient.on('connect_error', reject);
        });
    });

    afterAll(async () => {
        wsClient.disconnect();
        server.close();
        await teardownTestApp(app, container, tmpDir);
        await simulator.stop();
    });

    afterEach(async() => {
        simulator.removeAllDevices();
        wsEmitSpy.mockClear();
    });

    it('new device gets detected', async () => {
        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        simulator.addDevice({
            name: 'MockDevice',
            actuators: [
                { featureDescriptor: 'Vibrator', actuatorType: 'Vibrate', stepCount: 20 },
                { featureDescriptor: 'Switch',   actuatorType: 'Oscillate', stepCount: 2 },
            ],
            sensors: [{ featureDescriptor: 'Pressure', sensorType: 'Pressure', sensorRange: [0, 100] }],
        });

        const payload = await deviceConnected;

        const expectedAttributes = {
            provider: ButtplugIoWebsocketDeviceProvider.providerName,
            type: 'buttplugIo',
            attributes: {
                'Vibrate-0': {
                    type: 'range',
                    modifier: DeviceAttributeModifier.writeOnly,
                    min: 0,
                    max: 20,
                },
                'Oscillate-1': {
                    type: 'bool',
                    modifier: DeviceAttributeModifier.writeOnly,
                },
                'Pressure-0': {
                    type: 'range',
                    modifier: DeviceAttributeModifier.readOnly,
                    min: 0,
                    max: 100,
                },
            },
        };

        expect(payload).toMatchObject(expectedAttributes);

        assert(typeof payload === 'object' && payload !== null && 'deviceId' in payload);

        // GET /device/:id should also return the same attributes
        const resSingleDevice = await request(server).get(`/device/${payload.deviceId}`);
        expect(resSingleDevice.status).toBe(200);
        expect(resSingleDevice.body).toMatchObject(expectedAttributes);

        // GET /devices should list the device as well and return the same attributes for it
        const resDeviceList = await request(server).get('/devices');
        expect(resDeviceList.status).toBe(200);

        expect(resDeviceList.body.count).toBe(1);
        expect(resDeviceList.body.items[0]).toMatchObject(expectedAttributes);
    });

    it('attribute value can be set', async () => {
        simulator.receivedScalarCmds = [];

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        simulator.addDevice({
            name: 'MockVibe',
            actuators: [{ featureDescriptor: 'Vibrator', actuatorType: 'Vibrate', stepCount: 20 }],
        });
        const payload = await deviceConnected;

        assert(typeof payload === 'object' && payload !== null && 'deviceId' in payload);

        await request(server)
            .patch(`/device/${payload.deviceId}`)
            .send({ 'Vibrate-0': 10 })
            .expect(202);

        expect(simulator.receivedScalarCmds).toHaveLength(1);
        const cmd = simulator.receivedScalarCmds[0];
        expect(cmd?.actuatorType).toBe('Vibrate');
        expect(cmd?.index).toBe(0);
        expect(cmd?.scalar).toBeCloseTo(0.5);

        // via WebSocket event
        simulator.receivedScalarCmds = [];

        const deviceRefreshed = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceRefreshed);

        wsClient.emit(WebSocketEvent.deviceUpdateReceived, { deviceId: payload.deviceId, data: { 'Vibrate-0': 5 } });

        const payloadDeviceRefreshed = await deviceRefreshed;

        expect(payloadDeviceRefreshed).toMatchObject({ deviceId: payload.deviceId });

        expect(simulator.receivedScalarCmds).toHaveLength(1);
        const wsCmd = simulator.receivedScalarCmds[0];
        expect(wsCmd?.actuatorType).toBe('Vibrate');
        expect(wsCmd?.index).toBe(0);
        expect(wsCmd?.scalar).toBeCloseTo(0.25); // 5 / stepCount(20) = 0.25
    });

    it('device refreshes', async () => {
        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        const deviceIndex = simulator.addDevice({
            name: 'MockSensor2',
            sensors: [{ featureDescriptor: 'Pressure', sensorType: 'Pressure', sensorRange: [0, 100], reading: 42 }],
        });

        const payloadDeviceConnected = await deviceConnected;

        assert(typeof payloadDeviceConnected === 'object' && payloadDeviceConnected !== null && 'deviceId' in payloadDeviceConnected);

        const deviceRefreshed = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceRefreshed);
        simulator.setSensorReading(deviceIndex, 0, 42);
        const payloadDeviceRefreshed = await deviceRefreshed;

        const expectedPayload = { deviceId: payloadDeviceConnected.deviceId, attributes: { 'Pressure-0': { value: 42 } } };

        expect(payloadDeviceRefreshed).toMatchObject(expectedPayload);

        const res = await request(server).get(`/device/${payloadDeviceConnected.deviceId}`);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject(expectedPayload);
    });

    it('device disconnected', async () => {
        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        const deviceIndex = simulator.addDevice({
            name: 'MockDevice',
            actuators: [{ featureDescriptor: 'Vibrator', actuatorType: 'Vibrate', stepCount: 20 }],
        });

        const payload = await deviceConnected;
        assert(typeof payload === 'object' && payload !== null && 'deviceId' in payload);

        const deviceDisconnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceDisconnected);
        simulator.removeDevice(deviceIndex);
        const payloadDeviceDisconnected = await deviceDisconnected;

        expect(payloadDeviceDisconnected).toMatchObject({ deviceId: payload.deviceId });

        const res = await request(server).get('/devices');
        expect(res.status).toBe(200);
        expect(res.body.count).toBe(0);
    });
});
