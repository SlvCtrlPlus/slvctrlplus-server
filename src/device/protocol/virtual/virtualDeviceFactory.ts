import KnownDevice from "../../../settings/knownDevice.js";
import Device from "../../device.js";
import VirtualDevice from "./virtualDevice";

export default interface VirtualDeviceFactory
{
    create(knownDevice: KnownDevice, provider: string): Promise<VirtualDevice>;

    forDeviceType(): string;
}
