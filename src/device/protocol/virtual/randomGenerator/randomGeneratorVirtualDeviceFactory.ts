import RandomGeneratorVirtualDevice from "./randomGeneratorVirtualDevice.js";
import DateFactory from "../../../../factory/dateFactory.js";
import Settings from "../../../../settings/settings.js";
import Logger from "../../../../logging/Logger.js";
import Device from "../../../device.js";
import KnownDevice from "../../../../settings/knownDevice.js";
import VirtualDeviceFactory from "../virtualDeviceFactory.js";
import DeviceDiscriminator from "../../../../serialization/discriminator/deviceDiscriminator.js";

export default class RandomGeneratorVirtualDeviceFactory implements VirtualDeviceFactory
{
    private readonly dateFactory: DateFactory;

    private readonly settings: Settings;

    private readonly logger: Logger;

    public constructor(
        dateFactory: DateFactory,
        settings: Settings,
        logger: Logger
    ) {
        this.dateFactory = dateFactory;
        this.settings = settings;
        this.logger = logger;
    }

    public async create(knownDevice: KnownDevice, provider: string): Promise<Device> {
        return new Promise<Device>((resolve) => {
            const device = new RandomGeneratorVirtualDevice(
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

    public forDeviceType(): string {
        return DeviceDiscriminator.fromValue(RandomGeneratorVirtualDevice);
    }
}
