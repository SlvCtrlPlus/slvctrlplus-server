import EventEmitter from 'events';
import { Peripheral } from '@stoprocent/noble';
import DeviceProvider from './deviceProvider.js';
import DeviceManager, { DeviceInfo, DeviceManagerEvent } from '../deviceManager.js';
import Logger from '../../logging/Logger.js';
import { asyncHandler, promiseWithTimeout } from '../../util/async.js';
import { logError } from '../../util/error.js';
import { BleDeviceInfo } from '../transport/bleObserver.js';
import BleDevice, { InferBleDeviceAttributes, InferBleDeviceConfig } from '../bleDevice.js';
import { DeviceAttributes, DeviceEvent, DeviceNotifications, InferDeviceNotifications } from '../device.js';
import { AnyDeviceConfig } from '../deviceConfig.js';
import { DeviceId } from '../deviceId.js';

export default abstract class BleDeviceProvider<
    D extends BleDevice<TAttributes, TNotifications, TConfig>,
    TAttributes extends DeviceAttributes = InferBleDeviceAttributes<D>,
    TNotifications extends DeviceNotifications = InferDeviceNotifications<D>,
    TConfig extends AnyDeviceConfig = InferBleDeviceConfig<D>
> extends DeviceProvider
{
    private connectedDevices: Map<DeviceId, D> = new Map();

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

            if (!this.deviceManager.addDevice(deviceInfo, device)) {
                // The device's final id (assigned during connect/handshake) turned out to belong
                // to a disabled known device - addDevice() has already closed it, released it
                // from the acquire queue, and registered it for retry once re-enabled.
                return;
            }

            this.connectedDevices.set(device.getDeviceId, device);
            device.on(DeviceEvent.deviceDisconnected, (d) => this.connectedDevices.delete(d.getDeviceId));
        } catch (e: unknown) {
            logError(this.logger, 'Error while connecting to BLE device', e);
            this.deviceManager.releaseDetectedDevice(deviceInfo.id);
            await this.disconnectPeripheral(deviceInfo.peripheral);
        }
    }

    public override async stop(): Promise<void> {
        for (const device of this.connectedDevices.values()) {
            await device.close();
        }
        this.connectedDevices.clear();
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
        } else if (peripheral.state === 'connecting') {
            peripheral.cancelConnect();
        }
    }

    protected abstract connectBleDevice(deviceInfo: BleDeviceInfo): Promise<D | undefined>;
}
