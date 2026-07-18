import EventEmitter from 'events';
import Logger from '../../logging/Logger.js';
import DeviceManager from '../deviceManager.js';

export default abstract class DeviceProvider
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

    public async stop(): Promise<void> {
        return Promise.resolve();
    }
}
