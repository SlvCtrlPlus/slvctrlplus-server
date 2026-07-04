import Settings from '../../settings/settings.js';
import DeviceProviderFactory from './deviceProviderFactory.js';
import Logger from '../../logging/Logger.js';
import DeviceProvider from './deviceProvider.js';

export default class DeviceProviderManager
{
    private factories: Map<string, DeviceProviderFactory<any>>;

    private readonly logger: Logger;

    private providers: DeviceProvider[] = [];

    public constructor(
        factories: Map<string, DeviceProviderFactory<any>>,
        logger: Logger
    ) {
        this.factories = factories;
        this.logger = logger.child({ name: DeviceProviderManager.name });
    }

    public loadFromSettings(settings: Settings): void
    {
        const configuredDeviceSources = settings.getDeviceSources();

        this.logger.debug(`Found ${configuredDeviceSources.size} configured device source(s)`);

        for (const [id, deviceSource] of configuredDeviceSources) {
            const factory = this.factories.get(deviceSource.type)

            if (undefined === factory) {
                this.logger.warn(`Device source with id ${id} and type ${deviceSource.type} is not supported`);
                continue;
            }

            const provider = factory.create(deviceSource.config);

            this.providers.push(provider);
        }
    }

    public async startProviders(): Promise<void> {
        for (const provider of this.providers) {
            await provider.init();
        }
    }

    public async stopProviders(): Promise<void> {
        const errors: unknown[] = [];

        for (const provider of this.providers) {
            try {
                await provider.stop();
            } catch (error: unknown) {
                errors.push(error);
                this.logger.error('Failed to stop device provider', error);
            }
        }

        if (errors.length > 0) {
            throw new Error(`Failed to stop ${errors.length} device provider(s)`);
        }
    }
}
