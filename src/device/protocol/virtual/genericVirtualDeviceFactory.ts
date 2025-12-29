import KnownDevice from "../../../settings/knownDevice.js";
import VirtualDeviceFactory from "./virtualDeviceFactory.js";
import VirtualDevice from "./virtualDevice.js";
import DateFactory from "../../../factory/dateFactory.js";
import VirtualDeviceLogic from "./virtualDeviceLogic.js";
import {JsonObject} from "../../../types.js";
import Logger from "../../../logging/Logger.js";

type Constructor<T> = new (config: JsonObject, logger: Logger) => T;

export default class GenericVirtualDeviceFactory<T extends VirtualDeviceLogic> implements VirtualDeviceFactory
{
    private readonly dateFactory: DateFactory;

    private readonly ctor: Constructor<T>;

    private readonly logger: Logger;

    public constructor(
        ctor: Constructor<T>,
        dateFactory: DateFactory,
        logger: Logger
    ) {
        this.ctor = ctor;
        this.dateFactory = dateFactory;
        this.logger = logger;
    }

    public create(knownDevice: KnownDevice, provider: string): Promise<VirtualDevice>
    {
        return new Promise<VirtualDevice>((resolve) => {
            const deviceLogic = new this.ctor(knownDevice.config, this.logger);

            const device = new VirtualDevice(
                "1.0.0",
                knownDevice.id,
                knownDevice.name,
                knownDevice.type,
                provider,
                this.dateFactory.now(),
                knownDevice.config,
                deviceLogic
            );

            resolve(device);
        });
    }

    public forDeviceType(): string
    {
        return this.ctor.name;
    }
}
