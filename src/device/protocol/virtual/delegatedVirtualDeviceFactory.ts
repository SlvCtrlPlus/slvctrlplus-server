import VirtualDeviceFactory from "./virtualDeviceFactory.js";
import KnownDevice from "../../../settings/knownDevice.js";
import Device from "../../device.js";

export default class DelegatedVirtualDeviceFactory
{
    private readonly deviceFactories: Map<string, VirtualDeviceFactory> = new Map<string, VirtualDeviceFactory>();

    public async create(knownDevice: KnownDevice, provider: string): Promise<Device> {
        return new Promise<Device>((resolve) => {
            const factory = this.deviceFactories.get(knownDevice.type);

            const device = factory.create(knownDevice, provider);

            resolve(device);
        })
    }

    public addDeviceFactory(factory: VirtualDeviceFactory): void
    {
        this.deviceFactories.set(factory.forDeviceType(), factory);
    }
}
