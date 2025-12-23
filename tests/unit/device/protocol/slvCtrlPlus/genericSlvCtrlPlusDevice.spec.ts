import {mock} from "jest-mock-extended";
import GenericSlvCtrlPlusDevice from "../../../../../src/device/protocol/slvCtrlPlus/genericSlvCtrlPlusDevice";
import DeviceTransport from "../../../../../src/device/transport/deviceTransport";
import {DeviceAttributes} from "../../../../../src/device/device";

describe('GenericSlvCtrlPlusDevice', () => {

    function createDevice(attrs: DeviceAttributes): GenericSlvCtrlPlusDevice
    {
        const transport = mock<DeviceTransport>();

        const fwVersion = '10000';
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
        const device = createDevice({});

        const attrName = 'bool';

        // Act
        const result = expect(device.setAttribute(attrName, false));

        // Assert
        await result.rejects.toThrow(`Attribute with name '${attrName}' does not exist for this device`);
    });
})