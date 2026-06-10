import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import EventEmitter from 'events';
import { DeviceEvent } from '../../src/device/device.js';
import Settings from '../../src/settings/settings.js';
import DeviceManager, { DeviceManagerEvent } from '../../src/device/deviceManager.js';
import ButtplugIoWebsocketDeviceProvider from '../../src/device/protocol/buttplugIo/buttplugIoWebsocketDeviceProvider.js';
import ButtplugIoDeviceFactory from '../../src/device/protocol/buttplugIo/buttplugIoDeviceFactory.js';
import UuidFactory from '../../src/factory/uuidFactory.js';
import DateFactory from '../../src/factory/dateFactory.js';
import EventEmitterFactory from '../../src/factory/eventEmitterFactory.js';
import Logger from '../../src/logging/Logger.js';
import { ButtplugIoServerSimulator } from './helpers/buttplugIoServerSimulator.js';
import ButtplugIoDevice from '../../src/device/protocol/buttplugIo/buttplugIoDevice.js';
import IntRangeDeviceAttribute from '../../src/device/attribute/intRangeDeviceAttribute.js';
import BoolDeviceAttribute from '../../src/device/attribute/boolDeviceAttribute.js';
import IntDeviceAttribute from '../../src/device/attribute/intDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../src/device/attribute/deviceAttribute.js';
import Device from '../../src/device/device.js';
import { Int } from '../../src/util/numbers.js';

const noopLogger: Logger = {
    child: () => noopLogger,
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    fatal: () => {},
};

function waitForDeviceConnected(deviceManager: DeviceManager, timeoutMs = 3000): Promise<ButtplugIoDevice> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            deviceManager.off(DeviceManagerEvent.deviceConnected, listener);
            reject(new Error(`Timed out waiting for device to connect (>${timeoutMs}ms)`));
        }, timeoutMs);

        const listener = (device: Device): void => {
            clearTimeout(timeout);
            deviceManager.off(DeviceManagerEvent.deviceConnected, listener);
            resolve(device as ButtplugIoDevice);
        };

        deviceManager.on(DeviceManagerEvent.deviceConnected, listener);
    });
}

describe('ButtplugIO websocket device', () => {
    let simulator: ButtplugIoServerSimulator;
    let provider: ButtplugIoWebsocketDeviceProvider;
    let deviceManager: DeviceManager;

    beforeEach(async () => {
        simulator = new ButtplugIoServerSimulator();
        const port = await simulator.start();

        const deviceFactory = new ButtplugIoDeviceFactory(
            new UuidFactory(),
            new DateFactory(),
            new EventEmitterFactory(),
            new Settings(),
            noopLogger,
        );

        deviceManager = new DeviceManager(new EventEmitter(), new Map(), noopLogger);

        provider = new ButtplugIoWebsocketDeviceProvider(
            deviceManager,
            new EventEmitter(),
            deviceFactory,
            `127.0.0.1:${port}`,
            false, // autoScan
            true,  // useDeviceNameAsId
            noopLogger,
        );
    });

    afterEach(async () => {
        await provider.stop();
        await deviceManager.reset();
        await simulator.stop();
    });

    it('connects and parses all attribute types from the device list', async () => {
        // Single device with all three attribute mapping variants:
        //   actuator stepCount > 2  → IntRangeDeviceAttribute (write-only)
        //   actuator stepCount <= 2 → BoolDeviceAttribute (write-only)
        //   sensor with sensorRange → IntRangeDeviceAttribute (read-only)
        simulator.addDevice({
            name: 'MockDevice',
            actuators: [
                { featureDescriptor: 'Vibrator', actuatorType: 'Vibrate', stepCount: 20 },
                { featureDescriptor: 'Switch',   actuatorType: 'Oscillate', stepCount: 2 },
            ],
            sensors: [{ featureDescriptor: 'Pressure', sensorType: 'Pressure', sensorRange: [0, 100] }],
        });

        const deviceConnected = waitForDeviceConnected(deviceManager);
        await provider.init();
        const device = await deviceConnected;

        expect(device).toBeInstanceOf(ButtplugIoDevice);

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
        await provider.init();
        await new Promise(resolve => setTimeout(resolve, 200));

        const deviceConnected = waitForDeviceConnected(deviceManager);
        simulator.addDevice({
            name: 'LateDevice',
            actuators: [{ featureDescriptor: 'Vibrator', actuatorType: 'Vibrate', stepCount: 10 }],
        });

        expect(await deviceConnected).toBeInstanceOf(ButtplugIoDevice);
    });

    it('setAttribute sends a ScalarCmd with the correct normalised scalar value', async () => {
        simulator.addDevice({
            name: 'MockVibe',
            actuators: [{ featureDescriptor: 'Vibrator', actuatorType: 'Vibrate', stepCount: 20 }],
        });

        const deviceConnected = waitForDeviceConnected(deviceManager);
        await provider.init();
        const device = await deviceConnected;

        await device.setAttribute('Vibrate-0', Int.from(10));

        expect(simulator.receivedScalarCmds).toHaveLength(1);
        const cmd = simulator.receivedScalarCmds[0];
        expect(cmd?.actuatorType).toBe('Vibrate');
        expect(cmd?.index).toBe(0);
        expect(cmd?.scalar).toBeCloseTo(0.5); // 10 / 20
    });

    it('polls sensor values automatically at the configured 100ms interval', async () => {
        const deviceIndex = simulator.addDevice({
            name: 'MockSensor',
            sensors: [{ featureDescriptor: 'Pressure', sensorType: 'Pressure', sensorRange: [0, 100], reading: 77 }],
        });

        const deviceConnected = waitForDeviceConnected(deviceManager);
        await provider.init();
        const device = await deviceConnected;

        simulator.setSensorReading(deviceIndex, 0, 77);

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timed out waiting for device refresh')), 1000);
            device.on(DeviceEvent.deviceRefreshed, () => { clearTimeout(timeout); resolve(); });
        });

        expect((await device.getAttribute('Pressure-0'))?.value).toBe(77);
    });

    it('refresh reads the current sensor value from the server', async () => {
        const deviceIndex = simulator.addDevice({
            name: 'MockSensor',
            sensors: [{ featureDescriptor: 'Pressure', sensorType: 'Pressure', sensorRange: [0, 100], reading: 42 }],
        });

        const deviceConnected = waitForDeviceConnected(deviceManager);
        await provider.init();
        const device = await deviceConnected;

        simulator.setSensorReading(deviceIndex, 0, 42);
        await device.refresh();

        expect((await device.getAttribute('Pressure-0') as IntDeviceAttribute).value).toBe(42);
    });
});
