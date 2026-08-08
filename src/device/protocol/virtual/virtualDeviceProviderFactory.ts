import type DeviceProviderFactory from '../../provider/deviceProviderFactory.js';
import type Logger from '../../../logging/Logger.js';
import VirtualDeviceProvider from './virtualDeviceProvider.js';
import type SettingsManager from '../../../settings/settingsManager.js';
import type VirtualDeviceFactory from './virtualDeviceFactory.js';
import type DeviceManager from '../../deviceManager.js';

export default class VirtualDeviceProviderFactory implements DeviceProviderFactory<VirtualDeviceProvider>
{
    private readonly deviceManager: DeviceManager;

    private readonly deviceFactory: VirtualDeviceFactory;

    private readonly settingsManager: SettingsManager;

    private readonly logger: Logger;

    public constructor(
        deviceManager: DeviceManager,
        deviceFactory: VirtualDeviceFactory,
        settingsManager: SettingsManager,
        logger: Logger,
    ) {
        this.deviceManager = deviceManager;
        this.deviceFactory = deviceFactory;
        this.settingsManager = settingsManager;
        this.logger = logger;
    }

    public create(): VirtualDeviceProvider {
        return new VirtualDeviceProvider(
            this.deviceManager,
            this.deviceFactory,
            this.settingsManager,
            this.logger,
        );
    }
}
