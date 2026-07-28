import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import ButtplugIoWebsocketDeviceProviderFactory from '../../../../../src/device/protocol/buttplugIo/buttplugIoWebsocketDeviceProviderFactory.js';
import ButtplugIoWebsocketDeviceProvider from '../../../../../src/device/protocol/buttplugIo/buttplugIoWebsocketDeviceProvider.js';
import ButtplugIoDeviceFactory from '../../../../../src/device/protocol/buttplugIo/buttplugIoDeviceFactory.js';
import DeviceManager from '../../../../../src/device/deviceManager.js';
import Logger from '../../../../../src/logging/Logger.js';

describe('ButtplugIoWebsocketDeviceProviderFactory', () => {
    it('creates a provider wired with the given config, without requiring an eventEmitter', () => {
        const deviceManager = mock<DeviceManager>();
        const deviceFactory = mock<ButtplugIoDeviceFactory>();
        const logger = mock<Logger>();
        logger.child.mockReturnValue(logger);

        const factory = new ButtplugIoWebsocketDeviceProviderFactory(deviceManager, deviceFactory, logger);

        const provider = factory.create({ address: '127.0.0.1:12345', autoScan: true, useDeviceNameAsId: false });

        expect(provider).toBeInstanceOf(ButtplugIoWebsocketDeviceProvider);
        expect(logger.child).toHaveBeenCalledWith({ name: ButtplugIoWebsocketDeviceProvider.name });
    });

    it('creates a fresh provider instance on every call', () => {
        const deviceManager = mock<DeviceManager>();
        const deviceFactory = mock<ButtplugIoDeviceFactory>();
        const logger = mock<Logger>();
        logger.child.mockReturnValue(logger);

        const factory = new ButtplugIoWebsocketDeviceProviderFactory(deviceManager, deviceFactory, logger);

        const providerA = factory.create({ address: 'localhost:1', autoScan: false, useDeviceNameAsId: false });
        const providerB = factory.create({ address: 'localhost:2', autoScan: false, useDeviceNameAsId: false });

        expect(providerA).not.toBe(providerB);
    });
});