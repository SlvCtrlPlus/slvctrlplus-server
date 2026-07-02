import { Peripheral } from '@stoprocent/noble';
import BaseError from 'modern-errors';
import Device, { DeviceAttributes, DeviceNotifications, NoDeviceNotifications } from './device.js';
import { AnyDeviceConfig, NoDeviceConfig } from './deviceConfig.js';
import { Expose } from 'class-transformer';
import { EventEmitter } from 'events';
import { DeviceId } from './deviceId.js';
import { logError } from '../util/error.js';
import Logger from '../logging/Logger.js';
import { asyncHandler, promiseWithTimeout } from '../util/async.js';

export type InferBleDeviceAttributes<D extends BleDevice<any, any, any>> =
    D extends BleDevice<infer TAttrs, any, any> ? TAttrs : DeviceAttributes;

export type InferBleDeviceConfig<D extends BleDevice<any, any, any>> =
    D extends BleDevice<any, any, infer TCfg> ? TCfg : AnyDeviceConfig;

export default abstract class BleDevice<
    TAttributes extends DeviceAttributes = DeviceAttributes,
    TNotifications extends DeviceNotifications = NoDeviceNotifications,
    TConfig extends AnyDeviceConfig = NoDeviceConfig
> extends Device<TAttributes, TNotifications, TConfig>
{
    private readonly peripheral: Peripheral;

    private readonly rssiInterval: NodeJS.Timeout;
    private readonly reconnectHandler: () => void;
    private closing: boolean = false;

    @Expose()
    private rssi: number;

    protected logger: Logger;

    protected constructor(
        deviceId: DeviceId,
        deviceName: string,
        provider: string,
        peripheral: Peripheral,
        connectedSince: Date,
        controllable: boolean,
        attributes: TAttributes,
        config: TConfig,
        eventEmitter: EventEmitter,
        logger: Logger,
    ) {
        super(deviceId, deviceName, provider, connectedSince, controllable, attributes, config, eventEmitter);

        this.logger = logger.child({ name: this.constructor.name });

        this.peripheral = peripheral;
        this.rssi = peripheral.rssi;

        this.rssiInterval = setInterval(asyncHandler(
            async () => await this.requestRssiUpdate(),
            (e: unknown) => logError(this.logger,`Error during RSSI update for device ${this.deviceId}`, e)
        ), 5000);

        this.reconnectHandler = asyncHandler(
            async () => {
                this.logger.info(`BLE Device ${this.deviceId} disconnected, trying to reconnect`);
                try {
                    if (peripheral.state !== 'connected') {
                        await promiseWithTimeout(peripheral.connectAsync(), 3000, `Timed out (>3s) while reconnecting to device ${this.deviceId}`);
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
            (err: unknown) => logError(this.logger, `Error in reconnect handler for device ${this.deviceId}`, err)
        );

        this.peripheral.on('disconnect', this.reconnectHandler);
    }

    private async requestRssiUpdate(): Promise<void> {
        if (this.closing || this.peripheral.state === 'disconnected') {
            return;
        }

        try {
            const rssi = await promiseWithTimeout(this.peripheral.updateRssiAsync(), 750, `Timed out (>750ms) while updating RSSI for device ${this.deviceId}`);
            this.logger.debug(`Received RSSI update for device ${this.deviceId}: ${rssi}`);

            this.rssi = rssi;
            this.updateLastRefresh();
        } catch (e: unknown) {
            const error = BaseError.normalize(e);
            this.logger.warn(`Error updating RSSI for device ${this.deviceId}: ${error.message}`);
        }
    }

    protected override async doClose(): Promise<void> {
        this.closing = true;

        if (this.peripheral.state === 'connected') {
            try {
                await promiseWithTimeout(this.peripheral.disconnectAsync(), 750, `Timed out (>750ms) while disconnecting from device ${this.deviceId}`);
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
}
