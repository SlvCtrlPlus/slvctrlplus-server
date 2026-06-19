import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { AppInstance } from '../../src/app.js';
import ButtplugIoDevice from '../../src/device/protocol/buttplugIo/buttplugIoDevice.js';
import ButtplugIoWebsocketDeviceProvider from '../../src/device/protocol/buttplugIo/buttplugIoWebsocketDeviceProvider.js';
import WebSocketEvent from '../../src/device/webSocketEvent.js';
import IntRangeDeviceAttribute from '../../src/device/attribute/intRangeDeviceAttribute.js';
import BoolDeviceAttribute from '../../src/device/attribute/boolDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../src/device/attribute/deviceAttribute.js';
import { ButtplugIoServerSimulator } from './helpers/buttplugIoServerSimulator.js';
import { createTestApp, teardownTestApp, waitForNextWsEvent, getConnectedDevice, waitForNDevicesConnected } from './helpers/appHelper.js';
import ServiceMap from '../../src/serviceMap.js';
import { Container } from '@timesplinter/pimple';

process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';

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

describe('ButtplugIo websocket provider', () => {
    let simulator: ButtplugIoServerSimulator;
    let app: AppInstance;
    let container: Container<ServiceMap>;
    let tmpDir: string;
    let wsEmitSpy: ReturnType<typeof vi.spyOn>;

    beforeAll(async () => {
        simulator = new ButtplugIoServerSimulator();
        const simulatorPort = await simulator.start();

        simulator.addDevice({
            name: 'TestVibe',
            actuators: [{ featureDescriptor: 'Vibrator', actuatorType: 'Vibrate', stepCount: 20 }],
            sensors: [{ featureDescriptor: 'Pressure', sensorType: 'Pressure', sensorRange: [0, 100] }],
        });

        ({ app, container, tmpDir } = await createTestApp(makeButtplugSettings(simulatorPort)));

        wsEmitSpy = vi.spyOn(app.websocket, 'emit');

        await waitForNDevicesConnected(container, 1);
    });

    afterAll(async () => {
        await teardownTestApp(app, container, tmpDir);
        await simulator.stop();
    });

    it('registers the device in the device manager', () => {
        const devices = container.get('device.manager').getConnectedDevices();
        expect(devices).toHaveLength(1);
        expect(devices[0]).toBeInstanceOf(ButtplugIoDevice);
    });

    it('exposes the device via GET /devices', async () => {
        const res = await request(app.instance).get('/devices');
        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);
        expect(res.body.items[0]).toEqual(expect.objectContaining({
            provider: ButtplugIoWebsocketDeviceProvider.providerName,
            type: 'buttplugIo',
        }));
    });

    it('emits deviceConnected WebSocket event when the device connects', () => {
        expect(wsEmitSpy).toHaveBeenCalledWith(
            WebSocketEvent.deviceConnected,
            expect.objectContaining({ provider: ButtplugIoWebsocketDeviceProvider.providerName }),
        );
    });

    describe('device protocol', () => {
        it('connects and parses all attribute types from the device list', async () => {
            const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
            simulator.addDevice({
                name: 'MockDevice',
                actuators: [
                    { featureDescriptor: 'Vibrator', actuatorType: 'Vibrate', stepCount: 20 },
                    { featureDescriptor: 'Switch',   actuatorType: 'Oscillate', stepCount: 2 },
                ],
                sensors: [{ featureDescriptor: 'Pressure', sensorType: 'Pressure', sensorRange: [0, 100] }],
            });
            await deviceConnected;

            const device = getConnectedDevice<ButtplugIoDevice>(container, d => d.getDeviceName === 'MockDevice', "name 'MockDevice'");

            const vibe = await device.getAttribute('Vibrate-0') as IntRangeDeviceAttribute;
            expect(vibe).toBeInstanceOf(IntRangeDeviceAttribute);
            expect(vibe.modifier).toBe(DeviceAttributeModifier.writeOnly);
            expect(vibe.min).toBe(0);
            expect(vibe.max).toBe(20);

            const oscillate = await device.getAttribute('Oscillate-1');
            expect(oscillate).toBeInstanceOf(BoolDeviceAttribute);
            expect(oscillate?.modifier).toBe(DeviceAttributeModifier.writeOnly);

            const pressure = await device.getAttribute('Pressure-0') as IntRangeDeviceAttribute;
            expect(pressure).toBeInstanceOf(IntRangeDeviceAttribute);
            expect(pressure.modifier).toBe(DeviceAttributeModifier.readOnly);
            expect(pressure.min).toBe(0);
            expect(pressure.max).toBe(100);
        });

        it('picks up a device added via push after initial connection', async () => {
            await new Promise(resolve => setTimeout(resolve, 200));

            const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
            simulator.addDevice({
                name: 'LateDevice',
                actuators: [{ featureDescriptor: 'Vibrator', actuatorType: 'Vibrate', stepCount: 10 }],
            });

            const payload = await deviceConnected;
            expect(payload).toMatchObject({ provider: ButtplugIoWebsocketDeviceProvider.providerName });
        });

        it('setAttribute sends a ScalarCmd with the correct normalised scalar value', async () => {
            simulator.receivedScalarCmds = [];

            const deviceConnected = waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);
            simulator.addDevice({
                name: 'MockVibe',
                actuators: [{ featureDescriptor: 'Vibrator', actuatorType: 'Vibrate', stepCount: 20 }],
            });
            await deviceConnected;

            const device = getConnectedDevice<ButtplugIoDevice>(container, d => d.getDeviceName === 'MockVibe', "name 'MockVibe'");

            await request(app.instance)
                .patch(`/device/${device.getDeviceId}`)
                .send({ 'Vibrate-0': 10 })
                .expect(202);

            expect(simulator.receivedScalarCmds).toHaveLength(1);
            const cmd = simulator.receivedScalarCmds[0];
            expect(cmd?.actuatorType).toBe('Vibrate');
            expect(cmd?.index).toBe(0);
            expect(cmd?.scalar).toBeCloseTo(0.5);
        });

        it('polls sensor values automatically at the configured 100ms interval', async () => {
            const deviceIndex = simulator.addDevice({
                name: 'MockSensor',
                sensors: [{ featureDescriptor: 'Pressure', sensorType: 'Pressure', sensorRange: [0, 100], reading: 77 }],
            });

            await waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);

            simulator.setSensorReading(deviceIndex, 0, 77);

            const device = getConnectedDevice<ButtplugIoDevice>(container, d => d.getDeviceName === 'MockSensor', "name 'MockSensor'");

            await waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceRefreshed);

            const res = await request(app.instance).get(`/device/${device.getDeviceId}`);
            expect(res.status).toBe(200);
            expect(res.body.attributes['Pressure-0'].value).toBe(77);
        });

        it('refresh reads the current sensor value from the server', async () => {
            const deviceIndex = simulator.addDevice({
                name: 'MockSensor2',
                sensors: [{ featureDescriptor: 'Pressure', sensorType: 'Pressure', sensorRange: [0, 100], reading: 42 }],
            });

            await waitForNextWsEvent(wsEmitSpy, WebSocketEvent.deviceConnected);

            const device = getConnectedDevice<ButtplugIoDevice>(container, d => d.getDeviceName === 'MockSensor2', "name 'MockSensor2'");

            simulator.setSensorReading(deviceIndex, 0, 42);
            await device.refresh();

            const res = await request(app.instance).get(`/device/${device.getDeviceId}`);
            expect(res.status).toBe(200);
            expect(res.body.attributes['Pressure-0'].value).toBe(42);
        });
    });
});
