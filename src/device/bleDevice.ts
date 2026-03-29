import { Peripheral } from '@stoprocent/noble';
import BaseError from 'modern-errors';
import Device, { DeviceAttributes } from './device.js';
import { AnyDeviceConfig, NoDeviceConfig } from './deviceConfig.js';
import { Expose } from 'class-transformer';
import { EventEmitter } from 'events';
import { DeviceId } from './deviceId.js';
import { logError } from '../util/error.js';
import Logger from '../logging/Logger.js';
import { asyncHandler, promiseWithTimeout } from '../util/async.js';

export default abstract class BleDevice<
    TAttributes extends DeviceAttributes = DeviceAttributes,
    TConfig extends AnyDeviceConfig = NoDeviceConfig
> extends Device<TAttributes, TConfig>
{
    private readonly peripheral: Peripheral;

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

        const rssiInterval = setInterval(asyncHandler(
            async () => await this.requestRssiUpdate(),
            (e: unknown) => logError(this.logger,`Error during RSSI update for device ${this.deviceId}`, e)
        ), 5000);

        const reconnectHandler = asyncHandler(
            async () => {
                this.logger.info(`BLE Device ${this.deviceId} disconnected, trying to reconnect`);
                try {
                    await promiseWithTimeout(peripheral.connectAsync(), 2000);
                    this.logger.info(`BLE Device ${this.deviceId} reconnected successfully`);
                } catch (e) {
                    const error = BaseError.normalize(e);
                    this.logger.warn(`Error reconnecting to device ${this.deviceId}: ${error.message}`);
                    peripheral.off('disconnect', reconnectHandler);
                    clearInterval(rssiInterval);
                    await this.close();
                }
            },
            (err: unknown) => logError(this.logger, `Error in reconnect handler for device ${this.deviceId}`, err)
        );

        peripheral.on('disconnect', reconnectHandler);
    }

    private async requestRssiUpdate(): Promise<void> {
        if (this.peripheral.state === 'disconnected') {
            return;
        }

        try {
            const rssi = await promiseWithTimeout(this.peripheral.updateRssiAsync(), 1000);
            this.logger.debug(`Received RSSI update for device ${this.deviceId}: ${rssi}`);

            this.rssi = rssi;
            this.updateLastRefresh();
        } catch (e: unknown) {
            const error = BaseError.normalize(e);
            this.logger.warn(`Error updating RSSI for device ${this.deviceId}: ${error.message}`);
        }
    }

    protected override async doClose(): Promise<void> {
        if (this.peripheral.state === 'connected') {
            try {
                await promiseWithTimeout(this.peripheral.disconnectAsync(), 1000);
            } catch (error) {
                logError(this.logger, `Error disconnecting device ${this.deviceId}`, error);
            }
        } else if (this.peripheral.state === 'connecting') {
            this.peripheral.cancelConnect();
        }
    }
}