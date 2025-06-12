import VirtualDeviceFactory from "./virtualDeviceFactory.js";
import KnownDevice from "../../../settings/knownDevice.js";
import Device from "../../device.js";

export default class DelegatedVirtualDeviceFactory
{
    private readonly deviceFactories: Map<string, VirtualDeviceFactory> = new Map<string, VirtualDeviceFactory>();

    public async create(knownDevice: KnownDevice, provider: string): Promise<Device> {
        return new Promise<Device>((resolve) => {
            const factoryName = `${DelegatedVirtualDeviceFactory.capitalizeFirstLetter(knownDevice.type)}VirtualDeviceLogic`;
            if (!this.deviceFactories.has(factoryName)) {
                throw new Error(`No factory defined for virtual device '${knownDevice.type}'`);
            }

            const factory = this.deviceFactories.get(factoryName);
            const device = factory.create(knownDevice, provider);

            resolve(device);
        })
    }

    public addDeviceFactory(factory: VirtualDeviceFactory): void
    {
        this.deviceFactories.set(factory.forDeviceType(), factory);
    }

    private static capitalizeFirstLetter(str: string): string {
        if (!str) return "";
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}
