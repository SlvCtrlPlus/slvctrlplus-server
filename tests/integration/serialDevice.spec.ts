import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SerialPortMock } from 'serialport';
import EventEmitter from 'events';
import { adjectives, animals } from 'unique-names-generator';
import { PortInfo } from '@serialport/bindings-interface';
import Settings from '../../src/settings/settings.js';
import DeviceManager from '../../src/device/deviceManager.js';
import SlvCtrlPlusSerialDeviceProvider from '../../src/device/protocol/slvCtrlPlus/slvCtrlPlusSerialDeviceProvider.js';
import SlvCtrlPlusDeviceFactory from '../../src/device/protocol/slvCtrlPlus/slvCtrlPlusDeviceFactory.js';
import SerialDeviceTransportFactory from '../../src/device/transport/serialDeviceTransportFactory.js';
import UuidFactory from '../../src/factory/uuidFactory.js';
import DateFactory from '../../src/factory/dateFactory.js';
import EventEmitterFactory from '../../src/factory/eventEmitterFactory.js';
import DeviceNameGenerator from '../../src/device/deviceNameGenerator.js';
import MockSerialPortFactory from './helpers/mockSerialPortFactory.js';
import { SlvCtrlPlusDeviceSimulator } from './helpers/slvCtrlPlusDeviceSimulator.js';
import BoolDeviceAttribute from '../../src/device/attribute/boolDeviceAttribute.js';
import IntDeviceAttribute from '../../src/device/attribute/intDeviceAttribute.js';
import FloatDeviceAttribute from '../../src/device/attribute/floatDeviceAttribute.js';
import StrDeviceAttribute from '../../src/device/attribute/strDeviceAttribute.js';
import IntRangeDeviceAttribute from '../../src/device/attribute/intRangeDeviceAttribute.js';
import ListDeviceAttribute from '../../src/device/attribute/listDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../src/device/attribute/deviceAttribute.js';
import Logger from '../../src/logging/Logger.js';
import GenericSlvCtrlPlusDevice from '../../src/device/protocol/slvCtrlPlus/genericSlvCtrlPlusDevice.js';
import { Int } from '../../src/util/numbers.js';

const TEST_PORT_PATH = '/dev/test-slvctrl-0';

const noopLogger: Logger = {
    child: () => noopLogger,
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    fatal: () => {},
};

function makePortInfo(): PortInfo {
    return {
        path: TEST_PORT_PATH,
        manufacturer: 'TestMfg',
        serialNumber: 'SN-TEST-001',
        pnpId: undefined,
        locationId: undefined,
        vendorId: '1234', // non-Arduino vendorId skips the ReadyParser step
        productId: '5678',
    };
}

describe('SlvCtrl+ serial device', () => {
    let provider: SlvCtrlPlusSerialDeviceProvider;
    let simulator: SlvCtrlPlusDeviceSimulator;

    beforeEach(() => {
        SerialPortMock.binding.createPort(TEST_PORT_PATH, { echo: false, record: false });

        simulator = new SlvCtrlPlusDeviceSimulator();
        const mockPortFactory = new MockSerialPortFactory(simulator);

        const settings = new Settings();
        const deviceFactory = new SlvCtrlPlusDeviceFactory(
            new UuidFactory(),
            new DateFactory(),
            new EventEmitterFactory(),
            settings,
            new DeviceNameGenerator({ dictionaries: [adjectives, animals], separator: '-', length: 2 }),
            noopLogger,
        );

        provider = new SlvCtrlPlusSerialDeviceProvider(
            new DeviceManager(new EventEmitter(), new Map(), noopLogger),
            mockPortFactory,
            new EventEmitter(),
            deviceFactory,
            new SerialDeviceTransportFactory(),
            noopLogger,
        );
    });

    afterEach(() => {
        SerialPortMock.binding.reset();
    });

    it('connects successfully and returns a device', async () => {
        const device = await provider.connectToDevice(makePortInfo());

        expect(device).toBeInstanceOf(GenericSlvCtrlPlusDevice);
    });

    it('discovers all attribute types with correct types and modifiers', async () => {
        const device = (await provider.connectToDevice(makePortInfo())) as GenericSlvCtrlPlusDevice;

        // bool
        expect(await device.getAttribute('connected')).toBeInstanceOf(BoolDeviceAttribute);
        expect((await device.getAttribute('connected'))?.modifier).toBe(DeviceAttributeModifier.readOnly);
        expect(await device.getAttribute('enabled')).toBeInstanceOf(BoolDeviceAttribute);
        expect((await device.getAttribute('enabled'))?.modifier).toBe(DeviceAttributeModifier.readWrite);

        // int
        expect(await device.getAttribute('counter')).toBeInstanceOf(IntDeviceAttribute);
        expect((await device.getAttribute('counter'))?.modifier).toBe(DeviceAttributeModifier.readOnly);
        expect(await device.getAttribute('level')).toBeInstanceOf(IntDeviceAttribute);
        expect((await device.getAttribute('level'))?.modifier).toBe(DeviceAttributeModifier.readWrite);

        // float
        expect(await device.getAttribute('temperature')).toBeInstanceOf(FloatDeviceAttribute);
        expect((await device.getAttribute('temperature'))?.modifier).toBe(DeviceAttributeModifier.readOnly);
        expect(await device.getAttribute('gain')).toBeInstanceOf(FloatDeviceAttribute);
        expect((await device.getAttribute('gain'))?.modifier).toBe(DeviceAttributeModifier.readWrite);

        // string
        expect(await device.getAttribute('label')).toBeInstanceOf(StrDeviceAttribute);
        expect(await device.getAttribute('mode')).toBeInstanceOf(StrDeviceAttribute);

        // int range with bounds
        const intensity = await device.getAttribute('intensity') as IntRangeDeviceAttribute;
        expect(intensity).toBeInstanceOf(IntRangeDeviceAttribute);
        expect(intensity.min).toBe(0);
        expect(intensity.max).toBe(100);

        // string list and int list
        expect(await device.getAttribute('preset')).toBeInstanceOf(ListDeviceAttribute);
        expect(await device.getAttribute('channel')).toBeInstanceOf(ListDeviceAttribute);
    });

    it('updates all attribute values after refresh', async () => {
        const device = (await provider.connectToDevice(makePortInfo())) as GenericSlvCtrlPlusDevice;

        simulator.setValue('level', '7');
        simulator.setValue('enabled', '1');
        simulator.setValue('temperature', '98.6');

        await device.refresh();

        expect((await device.getAttribute('level'))?.value).toBe(7);
        expect((await device.getAttribute('enabled'))?.value).toBe(true);
        expect((await device.getAttribute('temperature'))?.value).toBeCloseTo(98.6);
    });

    it('setAttribute sends the correct serial command for each value type', async () => {
        const device = (await provider.connectToDevice(makePortInfo())) as GenericSlvCtrlPlusDevice;

        expect(await device.setAttribute('level', Int.from(9))).toBe(9);
        expect(simulator.getValue('level')).toBe('9');

        expect(await device.setAttribute('enabled', true)).toBe(true);
        expect(simulator.getValue('enabled')).toBe('1');

        expect(await device.setAttribute('mode', 'auto')).toBe('auto');
        expect(simulator.getValue('mode')).toBe('auto');

        expect(await device.setAttribute('intensity', Int.from(50))).toBe(50);
        expect(simulator.getValue('intensity')).toBe('50');

        expect(await device.setAttribute('preset', 'high')).toBe('high');
        expect(simulator.getValue('preset')).toBe('high');
    });
});
