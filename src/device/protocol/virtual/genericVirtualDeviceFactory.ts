import KnownDevice from "../../../settings/knownDevice.js";
import Device from "../../device.js";
import VirtualDeviceFactory from "./virtualDeviceFactory.js";
import VirtualDevice from "./virtualDevice.js";
import DateFactory from "../../../factory/dateFactory.js";
import VirtualDeviceLogic from "./virtualDeviceLogic.js";

type Constructor<T> = new (...args: any[]) => T;

export default class GenericVirtualDeviceFactory<T extends VirtualDeviceLogic> implements VirtualDeviceFactory
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
            const deviceLogic = new this.ctor(knownDevice.config);

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
