import ButtplugIoDeviceFactory from "./buttplugIoDeviceFactory.js";
import UuidFactory from "../../../factory/uuidFactory.js";
import Logger from "../../../logging/Logger.js";
import DateFactory from "../../../factory/dateFactory.js";
import Settings from "../../../settings/settings.js";
import {ButtplugIoWebsocketConfig} from "./buttplugIoWebsocketDeviceProvider.js";

export default class ButtplugIoDeviceFactoryFactory
{
    private readonly uuidFactory: UuidFactory;
    private readonly dateFactory: DateFactory;
    private readonly settings: Settings;
    private readonly logger: Logger;

    public constructor(uuidFactory: UuidFactory, dateFactory: DateFactory, settings: Settings, logger: Logger) {
        this.uuidFactory = uuidFactory;
        this.dateFactory = dateFactory;
        this.settings = settings;
        this.logger = logger;
    }

    public create(config: ButtplugIoWebsocketConfig): ButtplugIoDeviceFactory
    {
        return new ButtplugIoDeviceFactory(
            this.uuidFactory,
            this.dateFactory,
            this.settings,
            this.logger,
            config.useDeviceNameAsId
        );
    }
}
