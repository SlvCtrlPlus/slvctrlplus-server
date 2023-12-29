import DeviceProvider from "../../provider/deviceProvider.js";
import EventEmitter from "events";
import SerialDeviceTransportFactory from "../../transport/serialDeviceTransportFactory.js";
import DeviceProviderFactory from "../../provider/deviceProviderFactory.js";
import Logger from "../../../logging/Logger.js";
import ButtplugIoDeviceFactory from "./buttplugIoDeviceFactory.js";
import ButtplugIoWebsocketDeviceProvider from "./buttplugIoWebsocketDeviceProvider.js";

type ButtplugIoWebsocketConfig = {
    address: string,
}

export default class ButtplugIoWebsocketDeviceProviderFactory implements DeviceProviderFactory
{
    private readonly eventEmitter: EventEmitter;

    private readonly deviceFactory: ButtplugIoDeviceFactory;

    private readonly deviceTransportFactory: SerialDeviceTransportFactory;

    private readonly logger: Logger;

    public constructor(
        eventEmitter: EventEmitter,
        deviceFactory: ButtplugIoDeviceFactory,
        logger: Logger
    ) {
        this.eventEmitter = eventEmitter;
        this.deviceFactory = deviceFactory;
        this.logger = logger;
    }

    public create(config: ButtplugIoWebsocketConfig): DeviceProvider
    {
        // Scan for new SlvCtrl+ protocol serial devices every 3 seconds
        return new ButtplugIoWebsocketDeviceProvider(
            this.eventEmitter,
            this.deviceFactory,
            config.address,
            this.logger
        );
    }
}
