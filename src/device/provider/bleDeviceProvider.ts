import type { Peripheral } from '@stoprocent/noble';
import DeviceProvider from './deviceProvider.js';
import type { DeviceDetectionInfo } from '../deviceManager.js';
import type DeviceManager from '../deviceManager.js';
import type Logger from '../../logging/Logger.js';
import { promiseWithTimeout } from '../../util/async.js';
import { logError } from '../../util/error.js';
import type { BleDeviceDetectionInfo } from '../transport/bleObserver.js';
import type BleObserver from '../transport/bleObserver.js';
import type { AnyBleDevice } from '../bleDevice.js';

export default abstract class BleDeviceProvider<D extends AnyBleDevice> extends DeviceProvider<BleDeviceDetectionInfo, D>
{
    private static readonly DISCONNECT_TIMEOUT_MS = 2000;

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

    protected override async createDevice(deviceDetectionInfo: BleDeviceDetectionInfo): Promise<D> {
        return this.connectBleDevice(deviceDetectionInfo);
    }

    protected override async onConnectFailed(deviceDetectionInfo: BleDeviceDetectionInfo): Promise<void> {
        await this.disconnectPeripheral(deviceDetectionInfo.peripheral);
    }

    protected abstract connectBleDevice(deviceDetectionInfo: BleDeviceDetectionInfo): Promise<D>;

    private async disconnectPeripheral(peripheral: Peripheral): Promise<void> {
        if (peripheral.state === 'connected') {
            try {
                await promiseWithTimeout(
                    peripheral.disconnectAsync(),
                    BleDeviceProvider.DISCONNECT_TIMEOUT_MS,
                    `Timed out while disconnecting from device ${peripheral.id}`,
                );
            } catch (e: unknown) {
                logError(this.logger, `Error disconnecting peripheral ${peripheral.id}`, e);
            }
        } else if (peripheral.state === 'connecting') {
            peripheral.cancelConnect();
        }
    }
}
