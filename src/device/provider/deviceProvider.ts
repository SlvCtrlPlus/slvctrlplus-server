import EventEmitter from 'events';
import Logger from '../../logging/Logger.js';
import Device, { DeviceAttributes, InferDeviceAttributes, InferDeviceConfig } from '../device.js';
import { AnyDeviceConfig } from '../deviceConfig.js';
import DeviceManager from '../deviceManager.js';

export default abstract class DeviceProvider<
    D extends Device<TAttributes, TConfig>,
    TAttributes  extends DeviceAttributes = InferDeviceAttributes<D>,
    TConfig extends AnyDeviceConfig = InferDeviceConfig<D>
>
{
    protected readonly deviceManager: DeviceManager;

    protected readonly eventEmitter: EventEmitter;

    protected readonly logger: Logger;

    protected constructor(deviceManager: DeviceManager, eventEmitter: EventEmitter, logger: Logger) {
        this.deviceManager = deviceManager;
        this.eventEmitter = eventEmitter;
        this.logger = logger;
    }

    public async init(): Promise<void> {
        return Promise.resolve();
    }
}
