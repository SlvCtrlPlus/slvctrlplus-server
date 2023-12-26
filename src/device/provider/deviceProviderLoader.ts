import Settings from "../../settings/settings.js";
import DeviceProviderFactory from "./deviceProviderFactory.js";
import DeviceManager from "../deviceManager.js";

export default class DeviceProviderLoader
{
    private settings: Settings;

    private factories: Map<string, DeviceProviderFactory>;

    private readonly deviceManager: DeviceManager;

    public constructor(
        deviceManager: DeviceManager,
        settings: Settings,
        factories: Map<string, DeviceProviderFactory>
    ) {
        this.deviceManager = deviceManager;
        this.settings = settings;
        this.factories = factories;
    }

    public loadFromSettings(): void
    {
        const configuredDeviceSources = this.settings.getDeviceSources();

        console.log(`Found ${configuredDeviceSources.size} configured devices source(s)`);

        for (const [id, deviceSource] of configuredDeviceSources) {
            if (!this.factories.has(deviceSource.type)) {
                console.log(`Device source with id ${id} and type ${deviceSource.type} is not supported`);
                continue;
            }

            const factory = this.factories.get(deviceSource.type);
            const provider = factory.create(deviceSource.config);

            this.deviceManager.registerDeviceProvider(provider);
        }
    }
}
