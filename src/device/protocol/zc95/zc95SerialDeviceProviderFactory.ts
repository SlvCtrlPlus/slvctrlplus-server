import DeviceProvider from "../../provider/deviceProvider.js";
import EventEmitter from "events";
import DeviceProviderFactory from "../../provider/deviceProviderFactory.js";
import Logger from "../../../logging/Logger.js";
import Zc95SerialDeviceProvider from "./zc95SerialDeviceProvider.js";
import Zc95DeviceFactory from "./zc95DeviceFactory";

export default class Zc95SerialDeviceProviderFactory implements DeviceProviderFactory
{
    private readonly eventEmitter: EventEmitter;

    private readonly deviceFactory: Zc95DeviceFactory;

    private readonly logger: Logger;

    public constructor(
        eventEmitter: EventEmitter,
        deviceFactory: Zc95DeviceFactory,
        logger: Logger
    ) {
        this.eventEmitter = eventEmitter;
        this.deviceFactory = deviceFactory;
        this.logger = logger;
    }

    public create(): DeviceProvider
    {
        // Scan for new SlvCtrl+ protocol serial devices every 3 seconds
        return new Zc95SerialDeviceProvider(
            this.eventEmitter,
            this.deviceFactory,
            this.logger
        );
    }
}
