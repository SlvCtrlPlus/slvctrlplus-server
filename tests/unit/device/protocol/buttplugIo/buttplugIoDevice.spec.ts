import BoolGenericDeviceAttribute from "../../../../../src/device/attribute/boolGenericDeviceAttribute.js";
import RangeGenericDeviceAttribute from "../../../../../src/device/attribute/rangeGenericDeviceAttribute.js";
import StrGenericDeviceAttribute from "../../../../../src/device/attribute/strGenericDeviceAttribute.js";
import ButtplugIoDevice from "../../../../../src/device/protocol/buttplugIo/buttplugIoDevice.js";
import {mock} from 'jest-mock-extended';
import {ButtplugClientDevice} from "buttplug";
import GenericDeviceAttribute from "../../../../../src/device/attribute/genericDeviceAttribute.js";

describe('ButtplugIoDevice', () => {

    function createDevice(buttplugDeviceMock: ButtplugClientDevice, attrs: GenericDeviceAttribute[]): ButtplugIoDevice
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
        const device = createDevice(buttplugDeviceMock, []);

        const attrName = 'bool';

        // Act
        const result = expect(device.setAttribute(attrName, false));

        // Assert
        await result.rejects.toThrow(`Attribute with name '${attrName}' does not exist for this device`);
    });

    it('it updates device data and calls buttplugClientDevice on setting boolean attribute', async () => {

        // Arrange
        const buttplugDeviceMock = mock<ButtplugClientDevice>();

        const boolAttr = new BoolGenericDeviceAttribute();
        boolAttr.name = 'bool-1';

        const device = createDevice(
            buttplugDeviceMock,
            [boolAttr],
        );

        // Act
        await device.setAttribute(boolAttr.name, false);

        expect(device.getAttribute(boolAttr.name)).toStrictEqual(false);

        // Assert
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledTimes(1);
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledWith({ActuatorType: 'bool', Index: 1, Scalar: 0});
    });

    it('it updates device data and calls buttplugClientDevice on setting range attribute', async () => {

        // Arrange
        const buttplugDeviceMock = mock<ButtplugClientDevice>();

        const rangeAttr = new RangeGenericDeviceAttribute();
        rangeAttr.name = 'range-2';
        rangeAttr.min = 0;
        rangeAttr.max = 20;

        const device = createDevice(
            buttplugDeviceMock,
            [rangeAttr],
        );

        const newValue = 5;

        // Act
        await device.setAttribute(rangeAttr.name, newValue);

        expect(device.getAttribute(rangeAttr.name)).toStrictEqual(newValue);

        // Assert
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledTimes(1);
        expect(buttplugDeviceMock.scalar).toHaveBeenCalledWith({
            ActuatorType: 'range',
            Index: 2,
            Scalar: newValue/rangeAttr.max
        });
    });

    it('it throws error if unsupported attribute is set', async () => {

        // Arrange
        const buttplugDeviceMock = mock<ButtplugClientDevice>();

        const strAttr = new StrGenericDeviceAttribute();
        strAttr.name = 'str-3';

        const device = createDevice(
            buttplugDeviceMock,
            [strAttr],
        );

        // Act
        const result = expect(device.setAttribute(strAttr.name, 'foo'));

        // Assert
        await result.rejects.toThrow(
            `Only range and boolean attributes are currently supported for buttplug.io devices (attribute: ${strAttr.name})`
        );
    });
});
