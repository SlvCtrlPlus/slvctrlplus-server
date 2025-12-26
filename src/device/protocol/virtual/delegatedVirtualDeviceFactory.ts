import VirtualDeviceFactory from "./virtualDeviceFactory.js";
import KnownDevice from "../../../settings/knownDevice.js";
import VirtualDevice from "./virtualDevice";

export default class DelegatedVirtualDeviceFactory
{
    private readonly deviceFactories: Map<string, VirtualDeviceFactory> = new Map<string, VirtualDeviceFactory>();

    public async create(knownDevice: KnownDevice, provider: string): Promise<VirtualDevice> {
        return new Promise<VirtualDevice>((resolve) => {
            const factoryName = `${DelegatedVirtualDeviceFactory.capitalizeFirstLetter(knownDevice.type)}VirtualDeviceLogic`;

            const factory = this.deviceFactories.get(factoryName);

            if (undefined === factory) {
                throw new Error(`No factory defined for virtual device '${knownDevice.type}'`);
            }

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
