import DisplayVirtualDeviceLogic from "../../../../../../src/device/protocol/virtual/display/displayVirtualDeviceLogic.js";

describe('DisplayVirtualDevice', () => {

    function createDevice(): DisplayVirtualDeviceLogic {
        return new DisplayVirtualDeviceLogic(
            '1.0.0',
            'device-id',
            'device name',
            'device model',
            'buttplugIo',
            new Date(),
            {},
        );
    }

    it('it returns content that has been set', async () => {

        // Arrange
        const device = createDevice();

        const content = 'hello world';

        // Act
        await device.setAttribute('content', content);
        const result = expect(device.getAttribute('content'));

        // Assert
        result.toBe(content);
    });

    it('it has a refresh rate of 175ms', async () => {
        const device = createDevice();

        expect(device.getRefreshInterval).toBe(175);
    });
});
