import Settings from '../../settings/settings.js';
import DeviceProviderFactory from './deviceProviderFactory.js';
import DeviceManager from '../deviceManager.js';
import Logger from '../../logging/Logger.js';
import SerialPortObserver from '../transport/serialPortObserver.js';
import DeviceProvider from './deviceProvider.js';
import Device from '../device.js';

export default class DeviceProviderLoader
{
    private settings: Settings;

    private factories: Map<string, DeviceProviderFactory>;

    private readonly deviceManager: DeviceManager;

    private readonly serialPortObserver: SerialPortObserver;

    private readonly logger: Logger;

    private startedProviders: DeviceProvider<Device>[] = [];

    public constructor(
        deviceManager: DeviceManager,
        serialPortObserver: SerialPortObserver,
        settings: Settings,
        factories: Map<string, DeviceProviderFactory>,
        logger: Logger
    ) {
        this.deviceManager = deviceManager;
        this.serialPortObserver = serialPortObserver;
        this.settings = settings;
        this.factories = factories;
        this.logger = logger;
    }

    public async loadFromSettings(): Promise<void>
    {
        const configuredDeviceSources = this.settings.getDeviceSources();

        this.logger.debug(`Found ${configuredDeviceSources.size} configured device source(s)`);

        for (const [id, deviceSource] of configuredDeviceSources) {
            const factory = this.factories.get(deviceSource.type)

            if (undefined === factory) {
                this.logger.info(`Device source with id ${id} and type ${deviceSource.type} is not supported`);
                continue;
            }

            const provider = factory.create(deviceSource.config);

            await provider.init();
            this.startedProviders.push(provider);
        }
    }

    public stop(): void {
        for (const provider of this.startedProviders) {
            provider.stop();
        }
    }
}
