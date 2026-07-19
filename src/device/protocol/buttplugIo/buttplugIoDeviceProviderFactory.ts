import EventEmitter from 'events';
import DeviceProviderFactory from '../../provider/deviceProviderFactory.js';
import Logger from '../../../logging/Logger.js';
import ButtplugIoDeviceFactory from './buttplugIoDeviceFactory.js';
import ButtplugIoDeviceProvider from './buttplugIoDeviceProvider.js';
import DeviceManager from '../../deviceManager.js';

type ButtplugIoDeviceProviderConfig = {
    address: string,
    autoScan: boolean,
    useDeviceNameAsId: boolean
}

export default class ButtplugIoDeviceProviderFactory implements DeviceProviderFactory<ButtplugIoDeviceProvider>
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

    public create(config: ButtplugIoDeviceProviderConfig): ButtplugIoDeviceProvider
    {
        return new ButtplugIoDeviceProvider(
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
