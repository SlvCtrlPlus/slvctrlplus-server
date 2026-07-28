import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import VirtualDeviceProvider from '../../../../../src/device/protocol/virtual/virtualDeviceProvider.js';
import VirtualDeviceFactory from '../../../../../src/device/protocol/virtual/virtualDeviceFactory.js';
import SettingsManager from '../../../../../src/settings/settingsManager.js';
import SettingsEventType from '../../../../../src/settings/settingsEventType.js';
import DeviceManager from '../../../../../src/device/deviceManager.js';
import Logger from '../../../../../src/logging/Logger.js';

describe('VirtualDeviceProvider', () => {
    const create = (
        deviceManager = mock<DeviceManager>(),
        deviceFactory = mock<VirtualDeviceFactory>(),
        settingsManager = mock<SettingsManager>(),
        logger = (() => { const l = mock<Logger>(); l.child.mockReturnValue(l); return l; })()
    ) => ({ provider: new VirtualDeviceProvider(deviceManager, deviceFactory, settingsManager, logger), settingsManager, logger });

    it('constructs with the reduced constructor signature and names its child logger after the class', () => {
        const { provider, logger } = create();

        expect(provider).toBeInstanceOf(VirtualDeviceProvider);
        expect(logger.child).toHaveBeenCalledWith({ name: VirtualDeviceProvider.name });
    });

    it('subscribes to settings changes on start() and unsubscribes on stop()', async () => {
        const settingsManager = mock<SettingsManager>();
        settingsManager.getSettings.mockReturnValue(undefined);
        const { provider } = create(undefined, undefined, settingsManager);

        await provider.start();
        expect(settingsManager.on).toHaveBeenCalledWith(SettingsEventType.changed, expect.any(Function));

        await provider.stop();
        expect(settingsManager.off).toHaveBeenCalledWith(SettingsEventType.changed, expect.any(Function));
    });

    it('scans for configured virtual devices via the injected SettingsManager on start()', async () => {
        const settingsManager = mock<SettingsManager>();
        settingsManager.getSettings.mockReturnValue(undefined);
        const { provider } = create(undefined, undefined, settingsManager);

        await provider.start();

        expect(settingsManager.getSettings).toHaveBeenCalled();
    });
});