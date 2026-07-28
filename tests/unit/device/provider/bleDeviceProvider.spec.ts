import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import BleDeviceProvider from '../../../../src/device/provider/bleDeviceProvider.js';
import DeviceManager from '../../../../src/device/deviceManager.js';
import BleObserver, { BleDeviceDetectionInfo } from '../../../../src/device/transport/bleObserver.js';
import { AnyDevice } from '../../../../src/device/device.js';
import Logger from '../../../../src/logging/Logger.js';

// BleDeviceProvider is abstract; this concrete subclass exists purely to exercise the base
// class's constructor and doStart()/doStop() delegation.
class TestBleDeviceProvider extends BleDeviceProvider<AnyDevice>
{
    public constructor(deviceManager: DeviceManager, bleObserver: BleObserver, logger: Logger) {
        super(deviceManager, bleObserver, logger);
    }

    protected connectBleDevice(_deviceDetectionInfo: BleDeviceDetectionInfo): Promise<AnyDevice | undefined> {
        return Promise.resolve(undefined);
    }
}

describe('BleDeviceProvider', () => {
    it('constructs with the reduced constructor signature', () => {
        const deviceManager = mock<DeviceManager>();
        const bleObserver = mock<BleObserver>();
        const logger = mock<Logger>();

        const provider = new TestBleDeviceProvider(deviceManager, bleObserver, logger);

        expect(provider).toBeInstanceOf(BleDeviceProvider);
    });

    it('delegates doStart()/doStop() to the injected BleObserver', async () => {
        const deviceManager = mock<DeviceManager>();
        const bleObserver = mock<BleObserver>();
        const logger = mock<Logger>();

        const provider = new TestBleDeviceProvider(deviceManager, bleObserver, logger);

        await provider.start();
        expect(bleObserver.start).toHaveBeenCalledTimes(1);

        await provider.stop();
        expect(bleObserver.stop).toHaveBeenCalledTimes(1);
    });
});