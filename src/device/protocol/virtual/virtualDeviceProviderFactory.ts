import DeviceProvider from "../../provider/deviceProvider.js";
import EventEmitter from "events";
import DeviceProviderFactory from "../../provider/deviceProviderFactory.js";
import Logger from "../../../logging/Logger.js";
import VirtualDeviceProvider from "./virtualDeviceProvider.js";
import DelegatedVirtualDeviceFactory from "./delegatedVirtualDeviceFactory.js";
import SettingsManager from "../../../settings/settingsManager.js";

export default class VirtualDeviceProviderFactory implements DeviceProviderFactory
{
    private readonly eventEmitter: EventEmitter;

    private readonly deviceFactory: DelegatedVirtualDeviceFactory;

    private readonly settingsManager: SettingsManager;

    private readonly logger: Logger;

    public constructor(
        eventEmitter: EventEmitter,
        deviceFactory: DelegatedVirtualDeviceFactory,
        settingsManager: SettingsManager,
        logger: Logger
    ) {
        this.eventEmitter = eventEmitter;
        this.deviceFactory = deviceFactory;
        this.settingsManager = settingsManager;
        this.logger = logger;
    }

    public create(): DeviceProvider
    {
        return new VirtualDeviceProvider(
            this.eventEmitter,
            this.deviceFactory,
            this.settingsManager,
            this.logger
        );
    }
}
