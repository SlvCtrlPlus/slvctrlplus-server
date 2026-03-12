import EventEmitter from 'events';
import DeviceProviderFactory from '../../provider/deviceProviderFactory.js';
import Logger from '../../../logging/Logger.js';
import VirtualDeviceProvider from './virtualDeviceProvider.js';
import SettingsManager from '../../../settings/settingsManager.js';
import VirtualDeviceFactory from './virtualDeviceFactory.js';
import DeviceManager from '../../deviceManager.js';

export default class VirtualDeviceProviderFactory implements DeviceProviderFactory<VirtualDeviceProvider>
{
    private readonly deviceManager: DeviceManager;

    private readonly eventEmitter: EventEmitter;

    private readonly deviceFactory: VirtualDeviceFactory;

    private readonly settingsManager: SettingsManager;

    private readonly logger: Logger;

    public constructor(
        deviceManager: DeviceManager,
        eventEmitter: EventEmitter,
        deviceFactory: VirtualDeviceFactory,
        settingsManager: SettingsManager,
        logger: Logger
    ) {
        this.deviceManager = deviceManager;
        this.eventEmitter = eventEmitter;
        this.deviceFactory = deviceFactory;
        this.settingsManager = settingsManager;
        this.logger = logger;
    }

    public create(): VirtualDeviceProvider {
        return new VirtualDeviceProvider(
            this.deviceManager,
            this.eventEmitter,
            this.deviceFactory,
            this.settingsManager,
            this.logger
        );
    }
}
