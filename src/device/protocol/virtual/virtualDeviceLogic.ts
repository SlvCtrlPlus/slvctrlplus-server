import VirtualDevice from "./virtualDevice.js";
import {DeviceAttributes} from "../../device.js";
import {AnyDeviceConfig, NoDeviceConfig} from "../../deviceConfig.js";

export default interface VirtualDeviceLogic<
    TAttributes extends DeviceAttributes = DeviceAttributes,
    TConfig extends AnyDeviceConfig = NoDeviceConfig
> {
    refreshData(device: VirtualDevice<TAttributes, TConfig>): Promise<void>;

    configureAttributes(): TAttributes;

    get refreshInterval(): number;
}
