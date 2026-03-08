import EventEmitter from 'events';
import DeviceProviderEvent from './deviceProviderEvent.js';
import DeviceState from '../deviceState.js';
import Logger from '../../logging/Logger.js';
import Device, { DeviceAttributes } from '../device.js';
import { AnyDeviceConfig, NoDeviceConfig } from '../deviceConfig.js';

export default abstract class DeviceProvider<
    D extends Device<TAttributes, TConfig>,
    TAttributes extends DeviceAttributes = D extends Device<infer TAttrs, any> ? TAttrs : DeviceAttributes,
    TConfig extends AnyDeviceConfig = D extends Device<any, infer TCfg> ? TCfg : NoDeviceConfig
>
{
    protected readonly eventEmitter: EventEmitter;

    protected readonly logger: Logger;

    protected constructor(eventEmitter: EventEmitter, logger: Logger) {
        this.eventEmitter = eventEmitter;
        this.logger = logger;
    }

    public async init(): Promise<void> {
        return Promise.resolve();
    }

    public on(event: DeviceProviderEvent, listener: (device: D) => void): this {
        this.eventEmitter.on(event, listener);

        return this;
    }

    protected initDeviceStatusUpdater(device: D): NodeJS.Timeout {
        const deviceStatusUpdater = () => {
            if (device.getState === DeviceState.busy) {
                this.logger.trace(`Device not refreshed since it's currently busy: ${device.getDeviceId}`)
                return;
            }

            device.refreshData().then(() => device.updateLastRefresh()).catch(
                (e: Error) => this.logger.error(`device: ${device.getDeviceId} -> refreshData -> failed: ${e.message}`)
            );

            this.eventEmitter.emit(DeviceProviderEvent.deviceRefreshed, device);

            this.logger.trace(`Device refreshed: ${device.getDeviceId}`)
        };

        deviceStatusUpdater();

        return setInterval(deviceStatusUpdater, device.getRefreshInterval);
    }
}
