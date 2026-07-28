import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import VirtualDeviceProviderFactory from '../../../../../src/device/protocol/virtual/virtualDeviceProviderFactory.js';
import VirtualDeviceProvider from '../../../../../src/device/protocol/virtual/virtualDeviceProvider.js';
import VirtualDeviceFactory from '../../../../../src/device/protocol/virtual/virtualDeviceFactory.js';
import DeviceManager from '../../../../../src/device/deviceManager.js';
import SettingsManager from '../../../../../src/settings/settingsManager.js';
import Logger from '../../../../../src/logging/Logger.js';

describe('VirtualDeviceProviderFactory', () => {
    it('creates a provider wired with its dependencies, without requiring an eventEmitterFactory', () => {
        const deviceManager = mock<DeviceManager>();
        const deviceFactory = mock<VirtualDeviceFactory>();
        const settingsManager = mock<SettingsManager>();
        const logger = mock<Logger>();
        logger.child.mockReturnValue(logger);

        const factory = new VirtualDeviceProviderFactory(deviceManager, deviceFactory, settingsManager, logger);

        const provider = factory.create();

        expect(provider).toBeInstanceOf(VirtualDeviceProvider);
        expect(logger.child).toHaveBeenCalledWith({ name: VirtualDeviceProvider.name });
    });

    it('creates a fresh provider instance on every call', () => {
        const deviceManager = mock<DeviceManager>();
        const deviceFactory = mock<VirtualDeviceFactory>();
        const settingsManager = mock<SettingsManager>();
        const logger = mock<Logger>();
        logger.child.mockReturnValue(logger);

        const factory = new VirtualDeviceProviderFactory(deviceManager, deviceFactory, settingsManager, logger);

        expect(factory.create()).not.toBe(factory.create());
    });
});