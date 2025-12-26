import BoolDeviceAttribute from "../../../../../src/device/attribute/boolDeviceAttribute.js";
import IntRangeDeviceAttribute from "../../../../../src/device/attribute/intRangeDeviceAttribute.js";
import ButtplugIoDevice, {
    ButtplugIoDeviceAttributeKey,
    ButtplugIoDeviceAttributes
} from "../../../../../src/device/protocol/buttplugIo/buttplugIoDevice.js";
import {mock} from 'jest-mock-extended';
import {ButtplugClientDevice} from "buttplug";
import {DeviceAttributeModifier} from "../../../../../src/device/attribute/deviceAttribute.js";
import {Int} from "../../../../../src/util/numbers";

describe('ButtplugIoDevice', () => {

    function createDevice(buttplugDeviceMock: ButtplugClientDevice, attrs: ButtplugIoDeviceAttributes): ButtplugIoDevice
    {
        return new ButtplugIoDevice(
            'device-id',
            'device name',
            'device model',
            'buttplugIo',
            new Date(),
            buttplugDeviceMock,
            attrs,
        );
    }

    it('it throws an error if non-existing attribute is set', async () => {

        // Arrange
        const buttplugDeviceMock = mock<ButtplugClientDevice>();
        const device = createDevice(buttplugDeviceMock, {});

        const attrName = 'bool' as ButtplugIoDeviceAttributeKey;

        // Act
        const result = expect(device.setAttribute(attrName, false));

        // Assert
        await result.rejects.toThrow(`Attribute with name '${attrName}' does not exist for this device`);
    });

    it('it updates device data and calls buttplugClientDevice on setting boolean attribute', async () => {

        // Arrange
        const buttplugDeviceMock = mock<ButtplugClientDevice>();
        const boolAttrKey = 'bool-1' as ButtplugIoDeviceAttributeKey;

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
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledWith({ActuatorType: 'bool', Index: 1, Scalar: 0});
    });

    it('it updates device data and calls buttplugClientDevice on setting range attribute', async () => {

        // Arrange
        const buttplugDeviceMock = mock<ButtplugClientDevice>();

        const rangeAttrName = 'range-2' as ButtplugIoDeviceAttributeKey;
        const rangeAttr = IntRangeDeviceAttribute.create(
            rangeAttrName,
            undefined,
            DeviceAttributeModifier.writeOnly,
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
            ActuatorType: 'range',
            Index: 2,
            Scalar: newValue/rangeAttr.max
        });
    });
});
