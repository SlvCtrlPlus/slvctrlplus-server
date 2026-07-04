import {describe, it, expect} from "vitest";
import {mock} from "vitest-mock-extended";
import {EventEmitter} from "events";
import VirtualDevice from "../../../../../../src/device/protocol/virtual/virtualDevice.js";
import DisplayVirtualDeviceLogic
    from "../../../../../../src/device/protocol/virtual/display/displayVirtualDeviceLogic.js";
import Logger from "../../../../../../src/logging/Logger.js";
import { DeviceId } from '../../../../../../src/device/deviceId.js';

describe('DisplayVirtualDevice', () => {

    function createDevice(): VirtualDevice<DisplayVirtualDeviceLogic> {
        const virtualDeviceLogic = new DisplayVirtualDeviceLogic({});
        return new VirtualDevice(
            '1.0.0',
            DeviceId.create('device-id'),
            'device name',
            'device model',
            'buttplugIo',
            new Date(),
            {},
            virtualDeviceLogic,
            new EventEmitter(),
            mock<Logger>(),
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
