import EventEmitter from 'events';
import Logger from '../../logging/Logger.js';
import DeviceManager from '../deviceManager.js';
import Settings from '../../settings/settings.js';

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

    /**
     * Called whenever the settings have changed (e.g. via the `PUT /settings` endpoint or any
     * mutation of the settings object). Providers can override this to react to known devices
     * being enabled/disabled: closing devices that just got disabled and retrying connections
     * for devices that just got (re-)enabled.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async onSettingsChanged(settings: Settings): Promise<void> {
        return Promise.resolve();
    }
}
