import { afterAll, assert, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import EventEmitter from 'events';
import request from 'supertest';
import { io as ioClient } from 'socket.io-client';
import WebSocketEvent from '../../../src/device/webSocketEvent.js';
import { DeviceAttributeModifier } from '../../../src/device/attribute/deviceAttribute.js';
import { ButtplugIoServerSimulator } from '../helpers/buttplugIoServerSimulator.js';
import { ActuatorType, SensorType } from 'buttplug';
import { createTestApp, teardownTestApp, waitForNextWsEvent, createWsClient, TestApp } from '../helpers/appHelper.js';
import ButtplugIoWebsocketDeviceProvider from '../../../src/device/protocol/buttplugIo/buttplugIoWebsocketDeviceProvider.js';
import ButtplugIoDeviceFactory from '../../../src/device/protocol/buttplugIo/buttplugIoDeviceFactory.js';
import DeviceManager from '../../../src/device/deviceManager.js';
import Logger from '../../../src/logging/Logger.js';

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
    let app: TestApp;
    let simulator: ButtplugIoServerSimulator;
    let wsEmitSpy: ReturnType<typeof vi.spyOn>;
    let wsClient: ReturnType<typeof ioClient>;

    beforeAll(async () => {
        simulator = new ButtplugIoServerSimulator();
        const simulatorPort = await simulator.start();

        app = await createTestApp(makeButtplugSettings(simulatorPort));

        wsEmitSpy = vi.spyOn(app.websocket, 'emit');

        await simulator.waitForClientReady();

        wsClient = await createWsClient(app.httpServer);
    });

    afterAll(async () => {
        wsClient.disconnect();
        await teardownTestApp(app);
        await simulator.stop();
    });

    beforeEach(async() => {
        simulator.removeAllDevices();
        wsEmitSpy.mockClear();
    });

    it('new device gets detected', async () => {
        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        simulator.addDevice({
            name: 'MockDevice',
            actuators: [
                { featureDescriptor: 'Vibrator', actuatorType: ActuatorType.Vibrate, stepCount: 20 },
                { featureDescriptor: 'Switch',   actuatorType: ActuatorType.Oscillate, stepCount: 2 },
            ],
            sensors: [{ featureDescriptor: 'Pressure', sensorType: SensorType.Pressure, sensorRange: [0, 100] }],
        });

        const [payload] = await deviceConnected;

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

        // GET /device/:id should also return the same attributes
        const resSingleDevice = await request(app.httpServer).get(`/device/${payload.deviceId}`);
        expect(resSingleDevice.status).toBe(200);
        expect(resSingleDevice.body).toMatchObject(expectedAttributes);

        // GET /devices should list the device as well and return the same attributes for it
        const resDeviceList = await request(app.httpServer).get('/devices');
        expect(resDeviceList.status).toBe(200);

        expect(resDeviceList.body.count).toBe(1);
        expect(resDeviceList.body.items[0]).toMatchObject(expectedAttributes);
    });

    it('attribute value can be set', async () => {
        simulator.receivedScalarCmds = [];

        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        simulator.addDevice({
            name: 'MockVibe',
            actuators: [{ featureDescriptor: 'Vibrator', actuatorType: ActuatorType.Vibrate, stepCount: 20 }],
        });
        const [payload] = await deviceConnected;

        await request(app.httpServer)
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

        const [payloadDeviceRefreshed] = await deviceRefreshed;

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
            sensors: [{ featureDescriptor: 'Pressure', sensorType: SensorType.Pressure, sensorRange: [0, 100], reading: 42 }],
        });

        const [payloadDeviceConnected] = await deviceConnected;

        assert('deviceId' in payloadDeviceConnected);

        const nextReading = 77;

        const deviceRefreshed = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceRefreshed);
        simulator.setSensorReading(deviceIndex, 0, nextReading);
        const [payloadDeviceRefreshed] = await deviceRefreshed;

        const expectedPayload = { deviceId: payloadDeviceConnected.deviceId, attributes: { 'Pressure-0': { value: nextReading } } };

        expect(payloadDeviceRefreshed).toMatchObject(expectedPayload);

        const res = await request(app.httpServer).get(`/device/${payloadDeviceConnected.deviceId}`);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject(expectedPayload);
    });

    it('device disconnected', async () => {
        const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
        const deviceIndex = simulator.addDevice({
            name: 'MockDevice',
            actuators: [{ featureDescriptor: 'Vibrator', actuatorType: ActuatorType.Vibrate, stepCount: 20 }],
        });

        const [payload] = await deviceConnected;

        const deviceDisconnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceDisconnected);
        simulator.removeDevice(deviceIndex);
        const [payloadDeviceDisconnected] = await deviceDisconnected;

        expect(payloadDeviceDisconnected).toMatchObject({ deviceId: payload.deviceId });

        const res = await request(app.httpServer).get('/devices');
        expect(res.status).toBe(200);
        expect(res.body.count).toBe(0);
    });
});

describe('Buttplug.io auto scanning', () => {
    let simulator: ButtplugIoServerSimulator;
    let provider: ButtplugIoWebsocketDeviceProvider;

    beforeAll(async () => {
        simulator = new ButtplugIoServerSimulator();
        const simulatorPort = await simulator.start();

        const logger = mock<Logger>();
        logger.child.mockReturnValue(logger);

        // Construct the provider directly (no full app) so this test needs neither the shared
        // BLE/noble teardown nor the device-lifecycle app, and its repeated scanning can't
        // interfere with the other suite's timing. Tiny timers keep the duty-cycle fast.
        provider = new ButtplugIoWebsocketDeviceProvider(
            mock<DeviceManager>(),
            new EventEmitter(),
            mock<ButtplugIoDeviceFactory>(),
            `127.0.0.1:${simulatorPort}`,
            true,
            true,
            logger,
            40,
            15,
        );

        await provider.init();
    });

    afterAll(async () => {
        await provider.stop();
        await simulator.stop();
    });

    it('runs a repeating start/stop scan duty-cycle', async () => {
        // The provider should keep cycling: start a scan, stop it after the scan duration, then
        // start another after the interval. Seeing multiple starts *and* stops proves the whole
        // duty-cycle is looping rather than firing once.
        await simulator.waitForScanStartCount(2);
        await simulator.waitForScanStopCount(2);
    });
});
