import Settings from "../../settings/settings.js";
import DeviceProviderFactory from "./deviceProviderFactory.js";
import DeviceManager from "../deviceManager.js";
import Logger from "../../logging/Logger.js";

export default class DeviceProviderLoader
{
    private settings: Settings;

    private factories: Map<string, DeviceProviderFactory>;

    private readonly deviceManager: DeviceManager;

    private readonly logger: Logger;

    public constructor(
        deviceManager: DeviceManager,
        settings: Settings,
        factories: Map<string, DeviceProviderFactory>,
        logger: Logger
    ) {
        this.deviceManager = deviceManager;
        this.settings = settings;
        this.factories = factories;
        this.logger = logger;
    }

    public async loadFromSettings(): Promise<void>
    {
        const configuredDeviceSources = this.settings.getDeviceSources();

        this.logger.debug(`Found ${configuredDeviceSources.size} configured devices source(s)`);

        for (const [id, deviceSource] of configuredDeviceSources) {
            if (!this.factories.has(deviceSource.type)) {
                this.logger.info(`Device source with id ${id} and type ${deviceSource.type} is not supported`);
                continue;
            }

            const factory = this.factories.get(deviceSource.type);
            const provider = factory.create(deviceSource.config);

            await this.deviceManager.registerDeviceProvider(provider);
        }
    }
}
