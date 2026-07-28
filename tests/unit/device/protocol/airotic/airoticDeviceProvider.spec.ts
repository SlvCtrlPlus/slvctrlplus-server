import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import AiroticDeviceProvider from '../../../../../src/device/protocol/airotic/airoticDeviceProvider.js';
import AiroticDeviceFactory from '../../../../../src/device/protocol/airotic/airoticDeviceFactory.js';
import DeviceManager from '../../../../../src/device/deviceManager.js';
import BleObserver from '../../../../../src/device/transport/bleObserver.js';
import Logger from '../../../../../src/logging/Logger.js';

describe('AiroticDeviceProvider', () => {
    it('constructs with the reduced constructor signature and names its child logger after the class', () => {
        const deviceManager = mock<DeviceManager>();
        const bleObserver = mock<BleObserver>();
        const deviceFactory = mock<AiroticDeviceFactory>();
        const logger = mock<Logger>();
        logger.child.mockReturnValue(logger);

        const provider = new AiroticDeviceProvider(deviceManager, bleObserver, deviceFactory, logger);

        expect(provider).toBeInstanceOf(AiroticDeviceProvider);
        expect(logger.child).toHaveBeenCalledWith({ name: AiroticDeviceProvider.name });
    });

    it('delegates doStart()/doStop() to the injected BleObserver', async () => {
        const deviceManager = mock<DeviceManager>();
        const bleObserver = mock<BleObserver>();
        const deviceFactory = mock<AiroticDeviceFactory>();
        const logger = mock<Logger>();
        logger.child.mockReturnValue(logger);

        const provider = new AiroticDeviceProvider(deviceManager, bleObserver, deviceFactory, logger);

        await provider.start();
        expect(bleObserver.start).toHaveBeenCalledTimes(1);

        await provider.stop();
        expect(bleObserver.stop).toHaveBeenCalledTimes(1);
    });
});