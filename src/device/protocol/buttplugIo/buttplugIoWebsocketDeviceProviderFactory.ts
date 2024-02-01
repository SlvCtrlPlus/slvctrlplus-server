import DeviceProvider from "../../provider/deviceProvider.js";
import EventEmitter from "events";
import DeviceProviderFactory from "../../provider/deviceProviderFactory.js";
import Logger from "../../../logging/Logger.js";
import ButtplugIoWebsocketDeviceProvider, {ButtplugIoWebsocketConfig} from "./buttplugIoWebsocketDeviceProvider.js";
import ButtplugIoDeviceFactoryFactory from "./buttplugIoDeviceFactoryFactory.js";

export default class ButtplugIoWebsocketDeviceProviderFactory implements DeviceProviderFactory
{
    private readonly eventEmitter: EventEmitter;

    private readonly deviceFactoryFactory: ButtplugIoDeviceFactoryFactory;

    private readonly logger: Logger;

    public constructor(
        eventEmitter: EventEmitter,
        deviceFactoryFactory: ButtplugIoDeviceFactoryFactory,
        logger: Logger
    ) {
        this.eventEmitter = eventEmitter;
        this.deviceFactoryFactory = deviceFactoryFactory;
        this.logger = logger;
    }

    public create(config: ButtplugIoWebsocketConfig): DeviceProvider
    {
        return new ButtplugIoWebsocketDeviceProvider(
            this.eventEmitter,
            this.deviceFactoryFactory.create(config),
            config.address,
            this.logger
        );
    }
}
