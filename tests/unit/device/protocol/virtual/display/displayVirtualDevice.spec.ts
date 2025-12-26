import VirtualDevice from "../../../../../../src/device/protocol/virtual/virtualDevice.js";
import {mock} from "jest-mock-extended";
import VirtualDeviceLogic from "../../../../../../src/device/protocol/virtual/virtualDeviceLogic.js";
import DisplayVirtualDeviceLogic
    from "../../../../../../src/device/protocol/virtual/display/displayVirtualDeviceLogic.js";

describe('DisplayVirtualDevice', () => {

    function createDevice(): VirtualDevice {
        const virtualDeviceLogic = new DisplayVirtualDeviceLogic();
        return new VirtualDevice(
            '1.0.0',
            'device-id',
            'device name',
            'device model',
            'buttplugIo',
            new Date(),
            {},
            virtualDeviceLogic,
        );
    }

    it('it returns content that has been set', async () => {

        // Arrange
        const device = createDevice();

        const content = 'hello world';

        // Act
        await device.setAttribute('content', content);
        const result = expect((await device.getAttribute('content'))?.value);

        // Assert
        result.toBe(content);
    });

    it('it has a refresh rate of 175ms', async () => {
        const device = createDevice();

        expect(device.getRefreshInterval).toBe(175);
    });
});
