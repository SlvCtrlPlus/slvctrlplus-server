import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import GenericSlvCtrlPlusDevice from '../../../../../src/device/protocol/slvCtrlPlus/genericSlvCtrlPlusDevice.js';
import DeviceTransport from '../../../../../src/device/transport/deviceTransport.js';
import { SlvCtrlPlusDeviceAttributes } from '../../../../../src/device/protocol/slvCtrlPlus/slvCtrlPlusDevice.js';
import BoolDeviceAttribute from '../../../../../src/device/attribute/boolDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../../../../src/device/attribute/deviceAttribute.js';

describe('GenericSlvCtrlPlusDevice', () => {

    function createDevice(attrs: SlvCtrlPlusDeviceAttributes, transport: DeviceTransport): GenericSlvCtrlPlusDevice {
        const fwVersion = 10000;
        const deviceUuid = 'foo-bar-baz';
        const deviceName = 'Aston Martin';
        const model = 'et312';
        const protocolVersion = 10000;
        const provider = 'dummy';

        return new GenericSlvCtrlPlusDevice(
            fwVersion, deviceUuid, deviceName, model, provider, new Date(), transport, protocolVersion, attrs
        );
    }

    it('it throws an error if non-existing attribute is set', async () => {

        // Arrange
        const mockTransport = mock<DeviceTransport>();
        const attrName = 'bool';
        const device = createDevice({}, mockTransport);

        // Act
        const result = device.setAttribute(attrName, false);

        // Assert
        expect(mockTransport.sendAndAwaitReceive).not.toHaveBeenCalled();
        await expect(result).rejects.toThrow(`Attribute with name '${attrName}' does not exist for this device`);
    });

    it('it sets the attribute successfully', async () => {

        // Arrange
        const attrName = 'bool';
        const mockTransport = mock<DeviceTransport>();

        mockTransport.sendAndAwaitReceive
            .calledWith(`set-${attrName} 0\n`)
            .mockReturnValue(Promise.resolve(`set-bool;0;status:ok`));


        const device = createDevice({
            [attrName]: new BoolDeviceAttribute(attrName, 'Bool', DeviceAttributeModifier.readWrite, undefined)
        }, mockTransport);

        // Act
        const result = device.setAttribute(attrName, false);

        // Assert
        await expect(result).resolves.toStrictEqual(false);
    });

    it('it fails to set attribute: device reports the command as failed', async () => {

        // Arrange
        const attrName = 'bool';
        const mockTransport = mock<DeviceTransport>();

        mockTransport.sendAndAwaitReceive
            .calledWith(`set-${attrName} 0\n`)
            .mockReturnValue(Promise.resolve(`set-bool;;status:failed`));

        const device = createDevice({
            [attrName]: new BoolDeviceAttribute(attrName, 'Bool', DeviceAttributeModifier.readWrite, undefined)
        }, mockTransport);

        // Act
        const result = device.setAttribute(attrName, false);

        // Assert
        await expect(result).rejects.toThrow(`Device rejected 'set-${attrName}' with status 'failed'`);
    });

    it('it fails to set attribute: random response', async () => {

        // Arrange
        const attrName = 'bool';
        const randomResponse = `random stuff that has nothing to do with the command`;
        const mockTransport = mock<DeviceTransport>();
        mockTransport.sendAndAwaitReceive
            .calledWith(`set-${attrName} 0\n`)
            .mockReturnValue(Promise.resolve(randomResponse));

        const device = createDevice({
            [attrName]: new BoolDeviceAttribute(attrName, 'Bool', DeviceAttributeModifier.readWrite, undefined)
        }, mockTransport);

        // Act
        const result = device.setAttribute(attrName, false);

        // Assert
        await expect(result).rejects.toThrow(`Received unexpected response: ${randomResponse}`);
    });

    it('it fails to set attribute: response for different command', async () => {

        // Arrange
        const attrName = 'bool';
        const otherCommand = 'set-other';
        const mockTransport = mock<DeviceTransport>();
        mockTransport.sendAndAwaitReceive
            .calledWith(`set-${attrName} 0\n`)
            .mockReturnValue(Promise.resolve(`${otherCommand};0;status:ok`));

        const device = createDevice({
            [attrName]: new BoolDeviceAttribute(attrName, 'Bool', DeviceAttributeModifier.readWrite, undefined)
        }, mockTransport);

        // Act
        const result = device.setAttribute(attrName, false);

        // Assert
        await expect(result).rejects.toThrow(`Received response for unexpected command: ${otherCommand}`);
    });

    it.each([
        [undefined],
        [null],
    ])('it fails to set attribute: trying to set null or undefined', async (value) => {

        // Arrange
        const mockTransport = mock<DeviceTransport>();

        const attrName = 'bool';
        const device = createDevice({
            [attrName]: new BoolDeviceAttribute(attrName, 'Bool', DeviceAttributeModifier.readWrite, undefined)
        }, mockTransport);

        // Act
        const result = device.setAttribute(attrName, value);

        // Assert
        expect(mockTransport.sendAndAwaitReceive).not.toHaveBeenCalled();
        await expect(result).rejects.toThrow(`A non-null value must be set for the attribute with name '${attrName}'`);
    });
})