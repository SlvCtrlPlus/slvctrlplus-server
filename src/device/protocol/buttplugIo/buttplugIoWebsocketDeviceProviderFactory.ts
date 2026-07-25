import EventEmitter from 'events';
import DeviceProviderFactory from '../../provider/deviceProviderFactory.js';
import Logger from '../../../logging/Logger.js';
import ButtplugIoDeviceFactory from './buttplugIoDeviceFactory.js';
import ButtplugIoWebsocketDeviceProvider from './buttplugIoWebsocketDeviceProvider.js';
import DeviceManager from '../../deviceManager.js';

type ButtplugIoWebsocketDeviceProviderConfig = {
    address: string,
    autoScan: boolean,
    useDeviceNameAsId: boolean
}

export default class ButtplugIoWebsocketDeviceProviderFactory implements DeviceProviderFactory<ButtplugIoWebsocketDeviceProvider>
{
    private readonly deviceManager: DeviceManager;

    private readonly eventEmitter: EventEmitter;

    private readonly deviceFactory: ButtplugIoDeviceFactory;

    private readonly logger: Logger;

    public constructor(
        deviceManager: DeviceManager,
        eventEmitter: EventEmitter,
        deviceFactory: ButtplugIoDeviceFactory,
        logger: Logger
    ) {
        this.deviceManager = deviceManager;
        this.eventEmitter = eventEmitter;
        this.deviceFactory = deviceFactory;
        this.logger = logger;
    }

    public create(config: ButtplugIoWebsocketDeviceProviderConfig): ButtplugIoWebsocketDeviceProvider
    {
        return new ButtplugIoWebsocketDeviceProvider(
            this.deviceManager,
            this.eventEmitter,
            this.deviceFactory,
            config.address,
            config.autoScan,
            config.useDeviceNameAsId,
            this.logger
        );
    }
}
