import EventEmitter from 'events';
import { Peripheral } from '@stoprocent/noble';
import DetectedDeviceProvider from './detectedDeviceProvider.js';
import DeviceManager, { DeviceInfo } from '../deviceManager.js';
import Logger from '../../logging/Logger.js';
import { promiseWithTimeout } from '../../util/async.js';
import { logError } from '../../util/error.js';
import { BleDeviceInfo } from '../transport/bleObserver.js';
import BleDevice, { InferBleDeviceAttributes, InferBleDeviceConfig } from '../bleDevice.js';
import { DeviceAttributes, DeviceNotifications, InferDeviceNotifications } from '../device.js';
import { AnyDeviceConfig } from '../deviceConfig.js';

export default abstract class BleDeviceProvider<
    D extends BleDevice<TAttributes, TNotifications, TConfig>,
    TAttributes extends DeviceAttributes = InferBleDeviceAttributes<D>,
    TNotifications extends DeviceNotifications = InferDeviceNotifications<D>,
    TConfig extends AnyDeviceConfig = InferBleDeviceConfig<D>
> extends DetectedDeviceProvider<BleDeviceInfo, TAttributes, TNotifications, TConfig, D>
{
    protected constructor(deviceManager: DeviceManager, eventEmitter: EventEmitter, logger: Logger) {
        super(deviceManager, eventEmitter, logger);
    }

    protected override supportsDeviceInfo(deviceInfo: DeviceInfo): deviceInfo is BleDeviceInfo {
        return deviceInfo.type === 'ble';
    }

    protected override createDevice(deviceInfo: BleDeviceInfo): Promise<D | undefined> {
        return this.connectBleDevice(deviceInfo);
    }

    protected override async onConnectFailed(deviceInfo: BleDeviceInfo): Promise<void> {
        await this.disconnectPeripheral(deviceInfo.peripheral);
    }

    private async disconnectPeripheral(peripheral: Peripheral): Promise<void> {
        if (peripheral.state === 'connected') {
            try {
                await promiseWithTimeout(
                    peripheral.disconnectAsync(),
                    2000,
                    `Timed out while disconnecting from device ${peripheral.id}`
                );
            } catch (e: unknown) {
                logError(this.logger, `Error disconnecting peripheral ${peripheral.id}`, e);
            }
        } else if (peripheral.state === 'connecting') {
            peripheral.cancelConnect();
        }
    }

    protected abstract connectBleDevice(deviceInfo: BleDeviceInfo): Promise<D | undefined>;
}
