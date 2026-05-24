import EventEmitter from 'events';
import { Peripheral } from '@stoprocent/noble';
import DeviceProvider from './deviceProvider.js';
import DeviceManager, { DeviceInfo, DeviceManagerEvent } from '../deviceManager.js';
import Logger from '../../logging/Logger.js';
import { asyncHandler, promiseWithTimeout } from '../../util/async.js';
import { logError } from '../../util/error.js';
import { BleDeviceInfo } from '../transport/bleObserver.js';
import BleDevice, { InferBleDeviceAttributes, InferBleDeviceConfig } from '../bleDevice.js';
import { DeviceAttributes } from '../device.js';
import { AnyDeviceConfig } from '../deviceConfig.js';

export default abstract class BleDeviceProvider<
    D extends BleDevice<TAttributes, TConfig>,
    TAttributes extends DeviceAttributes = InferBleDeviceAttributes<D>,
    TConfig extends AnyDeviceConfig = InferBleDeviceConfig<D>
> extends DeviceProvider
{
    protected constructor(deviceManager: DeviceManager, eventEmitter: EventEmitter, logger: Logger) {
        super(deviceManager, eventEmitter, logger);

        this.deviceManager.on(
            DeviceManagerEvent.deviceDetected,
            asyncHandler(
                this.handleDeviceDetection.bind(this),
                (err: unknown) => logError(this.logger, 'Error in device detection handler', err)
            )
        );
    }

    private async handleDeviceDetection(deviceInfo: DeviceInfo): Promise<void> {
        if (!this.isBleDeviceInfo(deviceInfo)) {
            return;
        }

        this.logger.debug(`Requesting to acquire device: ${deviceInfo.id}`);

        const acquireResult = await this.deviceManager.acquireDetectedDevice(deviceInfo.id);

        if (!acquireResult.successful) {
            this.logger.debug(`Could not acquire device: ${acquireResult.reason}`);
            return;
        }

        try {
            const device = await this.connectBleDevice(deviceInfo);

            if (undefined === device) {
                this.deviceManager.releaseDetectedDevice(deviceInfo.id);
                return;
            }

            this.deviceManager.addDevice(device);
            this.deviceManager.claimDetectedDevice(deviceInfo.id);
        } catch (e: unknown) {
            logError(this.logger, 'Error while connecting to BLE device', e);
            this.deviceManager.releaseDetectedDevice(deviceInfo.id);
            await this.disconnectPeripheral(deviceInfo.peripheral);
        }
    }

    private isBleDeviceInfo(deviceInfo: DeviceInfo): deviceInfo is BleDeviceInfo {
        return deviceInfo.type === 'ble';
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
        }
    }

    protected abstract connectBleDevice(deviceInfo: BleDeviceInfo): Promise<D | undefined>;
}
