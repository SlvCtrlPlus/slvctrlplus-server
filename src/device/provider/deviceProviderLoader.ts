import Settings from '../../settings/settings.js';
import DeviceProviderFactory from './deviceProviderFactory.js';
import Logger from '../../logging/Logger.js';

export default class DeviceProviderLoader
{
    private settings: Settings;

    private factories: Map<string, DeviceProviderFactory>;

    private readonly logger: Logger;

    public constructor(
        settings: Settings,
        factories: Map<string, DeviceProviderFactory>,
        logger: Logger
    ) {
        this.settings = settings;
        this.factories = factories;
        this.logger = logger.child({ name: DeviceProviderLoader.name });
    }

    public async loadFromSettings(): Promise<void>
    {
        const configuredDeviceSources = this.settings.getDeviceSources();

        this.logger.debug(`Found ${configuredDeviceSources.size} configured device source(s)`);

        for (const [id, deviceSource] of configuredDeviceSources) {
            const factory = this.factories.get(deviceSource.type)

            if (undefined === factory) {
                this.logger.warn(`Device source with id ${id} and type ${deviceSource.type} is not supported`);
                continue;
            }

            const provider = factory.create(deviceSource.config);

            await provider.init();
        }
    }
}
