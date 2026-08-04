import { Peripheral } from '@stoprocent/noble';
import DeviceProvider from './deviceProvider.js';
import DeviceManager, { DeviceDetectionInfo } from '../deviceManager.js';
import Logger from '../../logging/Logger.js';
import { promiseWithTimeout } from '../../util/async.js';
import { logError } from '../../util/error.js';
import BleObserver, { BleDeviceDetectionInfo } from '../transport/bleObserver.js';
import { AnyBleDevice } from '../bleDevice.js';

export default abstract class BleDeviceProvider<D extends AnyBleDevice> extends DeviceProvider<BleDeviceDetectionInfo, D>
{
    private readonly bleObserver: BleObserver;

    protected constructor(deviceManager: DeviceManager, bleObserver: BleObserver, logger: Logger) {
        super(deviceManager, logger);
        this.bleObserver = bleObserver;
    }

    protected override async doStart(): Promise<void> {
        await this.bleObserver.start();
    }

    protected override async doStop(): Promise<void> {
        await this.bleObserver.stop();
    }

    protected override canHandleDeviceDetectionInfo(deviceDetectionInfo: DeviceDetectionInfo): deviceDetectionInfo is BleDeviceDetectionInfo {
        return deviceDetectionInfo.type === 'ble';
    }

    protected override createDevice(deviceDetectionInfo: BleDeviceDetectionInfo): Promise<D> {
        return this.connectBleDevice(deviceDetectionInfo);
    }

    protected override async onConnectFailed(deviceDetectionInfo: BleDeviceDetectionInfo): Promise<void> {
        await this.disconnectPeripheral(deviceDetectionInfo.peripheral);
    }

    private async disconnectPeripheral(peripheral: Peripheral): Promise<void> {
        if (peripheral.state === 'connected') {
            try {
                await promiseWithTimeout(
                    peripheral.disconnectAsync(),
                    2000,
                    `Timed out while disconnecting from device ${peripheral.id}`,
                );
            } catch (e: unknown) {
                logError(this.logger, `Error disconnecting peripheral ${peripheral.id}`, e);
            }
        } else if (peripheral.state === 'connecting') {
            peripheral.cancelConnect();
        }
    }

    protected abstract connectBleDevice(deviceDetectionInfo: BleDeviceDetectionInfo): Promise<D>;
}
