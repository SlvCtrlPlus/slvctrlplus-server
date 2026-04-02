import {ButtplugClientDevice, MessageAttributes, SensorDeviceMessageAttributes, SensorType} from "buttplug";
import BoolDeviceAttribute from "../../../../../src/device/attribute/boolDeviceAttribute.js";
import IntRangeDeviceAttribute from "../../../../../src/device/attribute/intRangeDeviceAttribute.js";
import IntDeviceAttribute from "../../../../../src/device/attribute/intDeviceAttribute.js";
import ButtplugIoDevice, {
    ButtplugIoDeviceAttributeKey,
    ButtplugIoDeviceAttributes
} from "../../../../../src/device/protocol/buttplugIo/buttplugIoDevice.js";
import {DeviceAttributeModifier} from "../../../../../src/device/attribute/deviceAttribute.js";
import {Int} from "../../../../../src/util/numbers.js";
import {describe, it, expect} from "vitest";
import {mock} from "vitest-mock-extended";
import { EventEmitter } from 'events';
import { DeviceId } from '../../../../../src/device/deviceId.js';

describe('ButtplugIoDevice', () => {

    function createDevice(buttplugDeviceMock: ButtplugClientDevice, attrs: ButtplugIoDeviceAttributes): ButtplugIoDevice
    {
        return new ButtplugIoDevice(
            DeviceId.create('device-id'),
            'device name',
            'device model',
            'buttplugIo',
            new Date(),
            buttplugDeviceMock,
            attrs,
            new EventEmitter(),
        );
    }

    it('it throws an error if non-existing attribute is set', async () => {

        // Arrange
        const buttplugDeviceMock = mock<ButtplugClientDevice>();
        const device = createDevice(buttplugDeviceMock, {});

        const attrName: ButtplugIoDeviceAttributeKey = 'Vibrate-1';

        // Act
        const result = expect(device.setAttribute(attrName, false));

        // Assert
        await result.rejects.toThrow(`Attribute with name '${attrName}' does not exist for this device`);
    });

    it('it updates device data and calls buttplugClientDevice on setting boolean attribute', async () => {

        // Arrange
        const buttplugDeviceMock = mock<ButtplugClientDevice>();
        const boolAttrKey: ButtplugIoDeviceAttributeKey = 'Rotate-1';

        const boolAttr = BoolDeviceAttribute.create(boolAttrKey, undefined, DeviceAttributeModifier.readWrite);

        const device = createDevice(
            buttplugDeviceMock,
            {[boolAttrKey]: boolAttr},
        );

        // Act
        await device.setAttribute(boolAttrKey, false);

        expect((await device.getAttribute(boolAttrKey))?.value).toStrictEqual(false);

        // Assert
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledTimes(1);
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledWith({ActuatorType: 'Rotate', Index: 1, Scalar: 0});
    });

    it('it updates device data and calls buttplugClientDevice on setting range attribute', async () => {

        // Arrange
        const buttplugDeviceMock = mock<ButtplugClientDevice>();

        const rangeAttrName: ButtplugIoDeviceAttributeKey = 'Vibrate-2';
        const rangeAttr = IntRangeDeviceAttribute.create(
            rangeAttrName,
            undefined,
            DeviceAttributeModifier.readWrite,
            undefined,
            Int.ZERO,
            Int.from(20),
            Int.from(1),
        );

        const device = createDevice(
            buttplugDeviceMock,
            {[rangeAttrName]: rangeAttr},
        );

        const newValue = 5;

        // Act
        await device.setAttribute(rangeAttrName, Int.from(newValue));

        expect((await device.getAttribute(rangeAttrName))?.value).toStrictEqual(newValue);

        // Assert
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledTimes(1);
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledWith({
            ActuatorType: 'Vibrate',
            Index: 2,
            Scalar: newValue/rangeAttr.max
        });
    });

    it('it updates device data and calls buttplugClientDevice on setting boolean attribute to true', async () => {

        // Arrange
        const buttplugDeviceMock = mock<ButtplugClientDevice>();
        const boolAttrKey: ButtplugIoDeviceAttributeKey = 'Rotate-1';
        const boolAttr = BoolDeviceAttribute.create(boolAttrKey, undefined, DeviceAttributeModifier.readWrite);
        const device = createDevice(buttplugDeviceMock, {[boolAttrKey]: boolAttr});

        // Act
        await device.setAttribute(boolAttrKey, true);

        // Assert
        expect((await device.getAttribute(boolAttrKey))?.value).toStrictEqual(true);
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledTimes(1);
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledWith({ActuatorType: 'Rotate', Index: 1, Scalar: 1});
    });

    it('it throws an error if attribute is read-only', async () => {

        // Arrange
        const buttplugDeviceMock = mock<ButtplugClientDevice>();
        const attrKey: ButtplugIoDeviceAttributeKey = 'Vibrate-1';
        const readOnlyAttr = BoolDeviceAttribute.create(attrKey, undefined, DeviceAttributeModifier.readOnly);
        const device = createDevice(buttplugDeviceMock, {[attrKey]: readOnlyAttr});

        // Act
        const result = device.setAttribute(attrKey, false);

        // Assert
        await expect(result).rejects.toThrow(`Attribute with name '${attrKey}' is readonly`);
        expect(buttplugDeviceMock.scalar).not.toHaveBeenCalled();
    });

    it('it throws an error for attribute with a sensor-type key', async () => {

        // Arrange
        const buttplugDeviceMock = mock<ButtplugClientDevice>();
        const sensorAttrKey: ButtplugIoDeviceAttributeKey = 'Battery-1';
        const attr = BoolDeviceAttribute.create(sensorAttrKey, undefined, DeviceAttributeModifier.readWrite);
        const device = createDevice(buttplugDeviceMock, {[sensorAttrKey]: attr});

        // Act
        const result = device.setAttribute(sensorAttrKey, false);

        // Assert
        await expect(result).rejects.toThrow(`Attribute with name '${sensorAttrKey}' does not correspond to a valid actuator type key`);
        expect(buttplugDeviceMock.scalar).not.toHaveBeenCalled();
    });

    it('it throws when setting attribute with undefined value', async () => {

        // Arrange
        const buttplugDeviceMock = mock<ButtplugClientDevice>();
        const attrKey: ButtplugIoDeviceAttributeKey = 'Vibrate-1';
        const attr = BoolDeviceAttribute.create(attrKey, undefined, DeviceAttributeModifier.readWrite);
        const device = createDevice(buttplugDeviceMock, {[attrKey]: attr});

        // Act
        const result = device.setAttribute(attrKey, undefined);

        // Assert
        await expect(result).rejects.toThrow(`Value to be set for attribute '${attrKey}' cannot be undefined`);
        expect(buttplugDeviceMock.scalar).not.toHaveBeenCalled();
    });

    it('it updates device data and calls buttplugClientDevice on setting int attribute', async () => {

        // Arrange
        const buttplugDeviceMock = mock<ButtplugClientDevice>();
        const attrKey: ButtplugIoDeviceAttributeKey = 'Oscillate-1';
        const attr = IntDeviceAttribute.createInitialized(attrKey, undefined, DeviceAttributeModifier.readWrite, undefined, Int.from(5));
        const device = createDevice(buttplugDeviceMock, {[attrKey]: attr});

        const newValue = Int.from(10);

        // Act
        await device.setAttribute(attrKey, newValue);

        // Assert
        expect((await device.getAttribute(attrKey))?.value).toStrictEqual(newValue);
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledTimes(1);
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledWith({ ActuatorType: 'Oscillate', Index: 1, Scalar: newValue });
    });

    it('it updates sensor attribute values on refresh', async () => {

        // Arrange
        const buttplugDeviceMock = mock<ButtplugClientDevice>();
        const sensorAttrKey: ButtplugIoDeviceAttributeKey = 'Battery-0';
        const sensorAttr = IntDeviceAttribute.createInitialized(sensorAttrKey, undefined, DeviceAttributeModifier.readOnly, undefined, Int.from(0));
        const device = createDevice(buttplugDeviceMock, {[sensorAttrKey]: sensorAttr});

        const sensorAttrDef = new SensorDeviceMessageAttributes({ Index: 0 });
        sensorAttrDef.SensorType = SensorType.Battery;
        Object.defineProperty(buttplugDeviceMock, 'messageAttributes', {
            get: () => new MessageAttributes({ SensorReadCmd: [sensorAttrDef] }),
            configurable: true,
        });
        buttplugDeviceMock.sensorRead.mockResolvedValue([85]);

        // Act
        await device.refresh();

        // Assert
        expect(buttplugDeviceMock.sensorRead).toHaveBeenCalledWith(0, SensorType.Battery);
        expect((await device.getAttribute(sensorAttrKey))?.value).toStrictEqual(Int.from(85));
    });

    it('it skips sensor refresh when device has no SensorReadCmd', async () => {

        // Arrange
        const buttplugDeviceMock = mock<ButtplugClientDevice>();
        const device = createDevice(buttplugDeviceMock, {});

        Object.defineProperty(buttplugDeviceMock, 'messageAttributes', {
            get: () => new MessageAttributes({}),
            configurable: true,
        });

        // Act
        await device.refresh();

        // Assert
        expect(buttplugDeviceMock.sensorRead).not.toHaveBeenCalled();
    });
});
