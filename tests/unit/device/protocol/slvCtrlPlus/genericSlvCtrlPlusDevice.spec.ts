import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import GenericSlvCtrlPlusDevice from '../../../../../src/device/protocol/slvCtrlPlus/genericSlvCtrlPlusDevice.js';
import { SlvCtrlPlusDeviceAttributes } from '../../../../../src/device/protocol/slvCtrlPlus/slvCtrlPlusDevice.js';
import BoolDeviceAttribute from '../../../../../src/device/attribute/boolDeviceAttribute.js';
import DeviceAttribute, { DeviceAttributeModifier } from '../../../../../src/device/attribute/deviceAttribute.js';
import SlvCtrlProtocol from '../../../../../src/device/protocol/slvCtrlPlus/slvCtrlProtocol.js';
import StrDeviceAttribute from '../../../../../src/device/attribute/strDeviceAttribute.js';

describe('GenericSlvCtrlPlusDevice', () => {

    function createDevice(attrs: SlvCtrlPlusDeviceAttributes, protocol: SlvCtrlProtocol): GenericSlvCtrlPlusDevice {
        const fwVersion = 10000;
        const deviceUuid = 'foo-bar-baz';
        const deviceName = 'Aston Martin';
        const model = 'et312';
        const protocolVersion = 10000;
        const provider = 'dummy';

        return new GenericSlvCtrlPlusDevice(
            fwVersion, deviceUuid, deviceName, model, provider, new Date(), protocol, protocolVersion, attrs
        );
    }

    it('it throws an error if non-existing attribute is set', async () => {

        // Arrange
        const mockProtocol = mock<SlvCtrlProtocol>();
        const attrName = 'bool';
        const device = createDevice({}, mockProtocol);

        // Act
        const result = device.setAttribute(attrName, false);

        // Assert
        expect(mockProtocol.setAttribute).not.toHaveBeenCalled();
        await expect(result).rejects.toThrow(`Attribute with name '${attrName}' does not exist for this device`);
    });

    it.each([
        [new BoolDeviceAttribute('bool', 'Bool', DeviceAttributeModifier.readWrite, undefined), false, '0'],
        [new StrDeviceAttribute('str', 'String', DeviceAttributeModifier.readWrite, undefined), 'foo', 'foo'],
    ])('it sets bool attribute successfully', async (attribute: DeviceAttribute, valueToSet, protocolValue) => {

        // Arrange
        const mockProtocol = mock<SlvCtrlProtocol>();

        mockProtocol.setAttribute
            .calledWith(attribute.name, protocolValue)
            .mockReturnValue(Promise.resolve(protocolValue));


        const device = createDevice({
            [attribute.name]: attribute
        }, mockProtocol);

        // Act
        const result = device.setAttribute(attribute.name, valueToSet);

        // Assert
        await expect(result).resolves.toStrictEqual(valueToSet);
    });

    it('it fails to set attribute: device reports the command as failed', async () => {

        // Arrange
        const attrName = 'bool';
        const exceptionMessage = 'Timed out';
        const mockProtocol = mock<SlvCtrlProtocol>();

        mockProtocol.setAttribute
            .calledWith(attrName, '0')
            .mockRejectedValue(new Error(exceptionMessage));

        const device = createDevice({
            [attrName]: new BoolDeviceAttribute(attrName, 'Bool', DeviceAttributeModifier.readWrite, undefined)
        }, mockProtocol);

        // Act
        const result = device.setAttribute(attrName, false);

        // Assert
        await expect(result).rejects.toThrow(exceptionMessage);
    });

    it.each([
        [undefined],
        [null],
    ])('it fails to set attribute: trying to set null or undefined', async (value) => {

        // Arrange
        const mockProtocol = mock<SlvCtrlProtocol>();

        const attrName = 'bool';
        const device = createDevice({
            [attrName]: new BoolDeviceAttribute(attrName, 'Bool', DeviceAttributeModifier.readWrite, undefined)
        }, mockProtocol);

        // Act
        const result = device.setAttribute(attrName, value);

        // Assert
        expect(mockProtocol.setAttribute).not.toHaveBeenCalled();
        await expect(result).rejects.toThrow(`A non-null value must be set for the attribute with name '${attrName}'`);
    });
})