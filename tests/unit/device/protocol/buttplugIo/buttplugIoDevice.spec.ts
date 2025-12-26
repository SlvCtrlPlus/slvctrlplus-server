import BoolDeviceAttribute from "../../../../../src/device/attribute/boolDeviceAttribute.js";
import IntRangeDeviceAttribute from "../../../../../src/device/attribute/intRangeDeviceAttribute.js";
import StrDeviceAttribute from "../../../../../src/device/attribute/strDeviceAttribute.js";
import ButtplugIoDevice, {
    ButtplugIoDeviceAttributes
} from "../../../../../src/device/protocol/buttplugIo/buttplugIoDevice.js";
import {mock} from 'jest-mock-extended';
import {ButtplugClientDevice} from "buttplug";
import DeviceAttribute from "../../../../../src/device/attribute/deviceAttribute.js";

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

        const attrName = 'bool';

        // Act
        const result = expect(device.setAttribute(attrName, false));

        // Assert
        await result.rejects.toThrow(`Attribute with name '${attrName}' does not exist for this device`);
    });

    it('it updates device data and calls buttplugClientDevice on setting boolean attribute', async () => {

        // Arrange
        const buttplugDeviceMock = mock<ButtplugClientDevice>();

        const boolAttr = new BoolDeviceAttribute();
        boolAttr.name = 'bool-1';

        const device = createDevice(
            buttplugDeviceMock,
            {'bool-1': boolAttr},
        );

        // Act
        await device.setAttribute(boolAttr.name, false);

        expect((await device.getAttribute(boolAttr.name)).value).toStrictEqual(false);

        // Assert
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledTimes(1);
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledWith({ActuatorType: 'bool', Index: 1, Scalar: 0});
    });

    it('it updates device data and calls buttplugClientDevice on setting range attribute', async () => {

        // Arrange
        const buttplugDeviceMock = mock<ButtplugClientDevice>();

        const rangeAttr = new IntRangeDeviceAttribute();
        rangeAttr.name = 'range-2';
        rangeAttr.min = 0;
        rangeAttr.max = 20;

        const device = createDevice(
            buttplugDeviceMock,
            {'range-2': rangeAttr},
        );

        const newValue = 5;

        // Act
        await device.setAttribute(rangeAttr.name, newValue);

        expect((await device.getAttribute(rangeAttr.name)).value).toStrictEqual(newValue);

        // Assert
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledTimes(1);
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledWith({
            ActuatorType: 'range',
            Index: 2,
            Scalar: newValue/rangeAttr.max
        });
    });
});
