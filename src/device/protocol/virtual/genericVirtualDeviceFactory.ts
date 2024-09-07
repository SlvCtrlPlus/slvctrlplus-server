import KnownDevice from "../../../settings/knownDevice.js";
import Device from "../../device.js";
import VirtualDeviceFactory from "./virtualDeviceFactory.js";
import VirtualDevice from "./virtualDevice.js";
import DateFactory from "../../../factory/dateFactory.js";
import Settings from "../../../settings/settings.js";
import Logger from "../../../logging/Logger.js";
import DeviceDiscriminator from "../../../serialization/discriminator/deviceDiscriminator.js";

type Constructor<T> = new (...args: any[]) => T;

export default class GenericVirtualDeviceFactory<T extends VirtualDevice> implements VirtualDeviceFactory
{

    private readonly dateFactory: DateFactory;

    private readonly ctor: Constructor<T>;

    public constructor(
        ctor: Constructor<T>,
        dateFactory: DateFactory
    ) {
        this.ctor = ctor;
        this.dateFactory = dateFactory;
    }


    public create(knownDevice: KnownDevice, provider: string): Promise<Device>
    {
        return new Promise<Device>((resolve) => {
            const device = new this.ctor(
                "1.0.0",
                knownDevice.id,
                knownDevice.name,
                knownDevice.type,
                provider,
                this.dateFactory.now(),
                knownDevice.config
            );

            resolve(device);
        })
    }

    public forDeviceType(): string
    {
        return DeviceDiscriminator.fromValue(this.ctor);
    }
}
