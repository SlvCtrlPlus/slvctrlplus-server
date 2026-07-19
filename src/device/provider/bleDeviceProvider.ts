import EventEmitter from 'events';
import { Peripheral } from '@stoprocent/noble';
import DeviceProvider from './deviceProvider.js';
import DeviceManager, { DeviceDetectionInfo } from '../deviceManager.js';
import Logger from '../../logging/Logger.js';
import { promiseWithTimeout } from '../../util/async.js';
import { logError } from '../../util/error.js';
import { BleDeviceDetectionInfo } from '../transport/bleObserver.js';
import { AnyBleDevice } from '../bleDevice.js';

export default abstract class BleDeviceProvider<D extends AnyBleDevice> extends DeviceProvider<BleDeviceDetectionInfo, D>
{
    protected constructor(deviceManager: DeviceManager, eventEmitter: EventEmitter, logger: Logger) {
        super(deviceManager, eventEmitter, logger);
    }

    protected override canHandleDeviceDetectionInfo(deviceInfo: DeviceDetectionInfo): deviceInfo is BleDeviceDetectionInfo {
        return deviceInfo.type === 'ble';
    }

    protected override createDevice(deviceInfo: BleDeviceDetectionInfo): Promise<D | undefined> {
        return this.connectBleDevice(deviceInfo);
    }

    protected override async onConnectFailed(deviceInfo: BleDeviceDetectionInfo): Promise<void> {
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

    protected abstract connectBleDevice(deviceInfo: BleDeviceDetectionInfo): Promise<D | undefined>;
}
