import KnownDevice from "../../../settings/knownDevice.js";
import Device from "../../device.js";

export default interface VirtualDeviceFactory
{
    create(knownDevice: KnownDevice, provider: string): Promise<Device>;

    forDeviceType(): string;
}
