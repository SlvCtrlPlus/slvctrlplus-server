import type DeviceProviderFactory from '../../provider/deviceProviderFactory.js';
import type Logger from '../../../logging/Logger.js';
import type ButtplugIoDeviceFactory from './buttplugIoDeviceFactory.js';
import ButtplugIoWebsocketDeviceProvider from './buttplugIoWebsocketDeviceProvider.js';
import type DeviceManager from '../../deviceManager.js';

type ButtplugIoWebsocketDeviceProviderConfig = {
    address: string;
    autoScan: boolean;
    useDeviceNameAsId: boolean;
};

export default class ButtplugIoWebsocketDeviceProviderFactory implements DeviceProviderFactory<ButtplugIoWebsocketDeviceProvider>
{
    private readonly deviceManager: DeviceManager;

    private readonly deviceFactory: ButtplugIoDeviceFactory;

    private readonly logger: Logger;

    public constructor(
        deviceManager: DeviceManager,
        deviceFactory: ButtplugIoDeviceFactory,
        logger: Logger,
    ) {
        this.deviceManager = deviceManager;
        this.deviceFactory = deviceFactory;
        this.logger = logger;
    }

    public create(config: ButtplugIoWebsocketDeviceProviderConfig): ButtplugIoWebsocketDeviceProvider
    {
        return new ButtplugIoWebsocketDeviceProvider(
            this.deviceManager,
            this.deviceFactory,
            config.address,
            config.autoScan,
            config.useDeviceNameAsId,
            this.logger,
        );
    }
}
