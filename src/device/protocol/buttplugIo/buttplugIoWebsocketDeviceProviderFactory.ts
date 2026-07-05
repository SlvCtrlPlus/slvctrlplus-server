import EventEmitter from 'events';
import DeviceProviderFactory from '../../provider/deviceProviderFactory.js';
import Logger from '../../../logging/Logger.js';
import ButtplugIoDeviceFactory from './buttplugIoDeviceFactory.js';
import ButtplugIoWebsocketDeviceProvider from './buttplugIoWebsocketDeviceProvider.js';
import DeviceManager from '../../deviceManager.js';
import KnownDeviceResolver from '../../knownDeviceResolver.js';

type ButtplugIoWebsocketConfig = {
    address: string,
    autoScan: boolean,
    useDeviceNameAsId: boolean
}

export default class ButtplugIoWebsocketDeviceProviderFactory implements DeviceProviderFactory<ButtplugIoWebsocketDeviceProvider>
{
    private readonly deviceManager: DeviceManager;

    private readonly eventEmitter: EventEmitter;

    private readonly knownDeviceResolver: KnownDeviceResolver;

    private readonly deviceFactory: ButtplugIoDeviceFactory;

    private readonly logger: Logger;

    public constructor(
        deviceManager: DeviceManager,
        eventEmitter: EventEmitter,
        knownDeviceResolver: KnownDeviceResolver,
        deviceFactory: ButtplugIoDeviceFactory,
        logger: Logger
    ) {
        this.deviceManager = deviceManager;
        this.eventEmitter = eventEmitter;
        this.knownDeviceResolver = knownDeviceResolver;
        this.deviceFactory = deviceFactory;
        this.logger = logger;
    }

    public create(config: ButtplugIoWebsocketConfig): ButtplugIoWebsocketDeviceProvider
    {
        return new ButtplugIoWebsocketDeviceProvider(
            this.deviceManager,
            this.eventEmitter,
            this.knownDeviceResolver,
            this.deviceFactory,
            config.address,
            config.autoScan,
            config.useDeviceNameAsId,
            this.logger
        );
    }
}
