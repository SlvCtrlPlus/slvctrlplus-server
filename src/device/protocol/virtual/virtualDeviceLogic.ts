import VirtualDevice from "./virtualDevice.js";
import {DeviceAttributes} from "../../device.js";
import {AnyDeviceConfig} from "../../anyDeviceConfig.js";

export default interface VirtualDeviceLogic<T extends DeviceAttributes = DeviceAttributes, C extends AnyDeviceConfig = AnyDeviceConfig>
{
    refreshData(device: VirtualDevice<T, C>): Promise<void>;

    configureAttributes(): T;

    get refreshInterval(): number;
}
