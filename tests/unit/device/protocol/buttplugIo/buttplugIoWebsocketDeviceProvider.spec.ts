import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import ButtplugIoWebsocketDeviceProvider from '../../../../../src/device/protocol/buttplugIo/buttplugIoWebsocketDeviceProvider.js';
import ButtplugIoDeviceFactory from '../../../../../src/device/protocol/buttplugIo/buttplugIoDeviceFactory.js';
import DeviceManager from '../../../../../src/device/deviceManager.js';
import Logger from '../../../../../src/logging/Logger.js';

describe('ButtplugIoWebsocketDeviceProvider', () => {
    it('constructs with the reduced constructor signature and names its child logger after the class', () => {
        const deviceManager = mock<DeviceManager>();
        const deviceFactory = mock<ButtplugIoDeviceFactory>();
        const logger = mock<Logger>();
        logger.child.mockReturnValue(logger);

        const provider = new ButtplugIoWebsocketDeviceProvider(
            deviceManager,
            deviceFactory,
            'localhost:12345',
            true,
            false,
            logger
        );

        expect(provider).toBeInstanceOf(ButtplugIoWebsocketDeviceProvider);
        expect(logger.child).toHaveBeenCalledWith({ name: ButtplugIoWebsocketDeviceProvider.name });
    });
});