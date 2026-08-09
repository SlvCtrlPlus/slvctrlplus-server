import type { Peripheral } from '@stoprocent/noble';
import BaseError from 'modern-errors';
import type { DeviceAttributes, DeviceInfo, DeviceNotifications, NoDeviceNotifications, WithUntypedAttributes } from './device.js';
import Device from './device.js';
import type { AnyDeviceConfig, NoDeviceConfig } from './deviceConfig.js';
import { Expose } from 'class-transformer';
import type { EventEmitter } from 'events';
import { logError } from '../util/error.js';
import type Logger from '../logging/Logger.js';
import { asyncHandler, promiseWithTimeout } from '../util/async.js';

export type AnyBleDevice = WithUntypedAttributes<BleDevice>;

export default abstract class BleDevice<
    TAttributes extends DeviceAttributes = DeviceAttributes,
    TNotifications extends DeviceNotifications = NoDeviceNotifications,
    TConfig extends AnyDeviceConfig = NoDeviceConfig,
> extends Device<TAttributes, TNotifications, TConfig>
{
    private static readonly RSSI_UPDATE_INTERVAL_MS = 5000;
    private static readonly RECONNECT_TIMEOUT_MS = 3000;
    private static readonly COMMAND_TIMEOUT_MS = 750;

    private readonly peripheral: Peripheral;

    private readonly rssiInterval: NodeJS.Timeout;
    private readonly reconnectHandler: () => void;
    private closing = false;

    @Expose()
    // eslint-disable-next-line @typescript-eslint/no-unused-private-class-members
    private rssi: number;

    protected constructor(
        deviceInfo: DeviceInfo,
        peripheral: Peripheral,
        attributes: TAttributes,
        config: TConfig,
        eventEmitter: EventEmitter,
        logger: Logger,
    ) {
        super(deviceInfo, attributes, config, eventEmitter, logger);

        this.peripheral = peripheral;
        this.rssi = peripheral.rssi;

        this.rssiInterval = setInterval(asyncHandler(
            async () => { await this.requestRssiUpdate() },
            (e: unknown) => logError(this.logger, `Error during RSSI update for device ${this.deviceId}`, e),
        ), BleDevice.RSSI_UPDATE_INTERVAL_MS);

        this.reconnectHandler = asyncHandler(
            async () => {
                this.logger.info(`BLE Device ${this.deviceId} disconnected, trying to reconnect`);
                try {
                    if (peripheral.state !== 'connected') {
                        await promiseWithTimeout(peripheral.connectAsync(), BleDevice.RECONNECT_TIMEOUT_MS, `Timed out (>3s) while reconnecting to device ${this.deviceId}`);
                        this.logger.info(`BLE Device ${this.deviceId} reconnected successfully`);
                    } else {
                        this.logger.warn(`BLE Device ${this.deviceId} is not in disconnected state, current state: ${peripheral.state}`);
                    }
                } catch (e) {
                    const error = BaseError.normalize(e);
                    this.logger.warn(`Error reconnecting to device ${this.deviceId}: ${error.message}`);
                    await this.close();
                }
            },
            (err: unknown) => logError(this.logger, `Error in reconnect handler for device ${this.deviceId}`, err),
        );

        this.peripheral.on('disconnect', this.reconnectHandler);
    }

    public getPeripheral(): Peripheral {
        return this.peripheral;
    }

    protected override async doClose(): Promise<void> {
        this.closing = true;

        if (this.peripheral.state === 'connected') {
            try {
                await promiseWithTimeout(this.peripheral.disconnectAsync(), BleDevice.COMMAND_TIMEOUT_MS, `Timed out (>750ms) while disconnecting from device ${this.deviceId}`);
            } catch (error) {
                if (error instanceof Error && error.message.includes('BLEManager has already been cleaned up')) {
                    return;
                }
                logError(this.logger, `Error disconnecting device ${this.deviceId}`, error);
            }
        } else if (this.peripheral.state === 'connecting') {
            this.peripheral.cancelConnect();
        }

        clearInterval(this.rssiInterval);
        this.peripheral.off('disconnect', this.reconnectHandler);
    }

    private async requestRssiUpdate(): Promise<void> {
        if (this.closing || this.peripheral.state === 'disconnected') {
            return;
        }

        try {
            const rssi = await promiseWithTimeout(this.peripheral.updateRssiAsync(), BleDevice.COMMAND_TIMEOUT_MS, `Timed out (>750ms) while updating RSSI for device ${this.deviceId}`);
            this.logger.trace(`Received RSSI update for device ${this.deviceId}: ${rssi}`);

            this.rssi = rssi;
            this.updateLastRefresh();
        } catch (e: unknown) {
            const error = BaseError.normalize(e);
            this.logger.warn(`Error updating RSSI for device ${this.deviceId}: ${error.message}`);
        }
    }
}
