import VirtualDevice from "./virtualDevice.js";
import {DeviceAttributes} from "../../device.js";
import {DeviceConfig, NoDeviceConfig} from "../../deviceConfig.js";

export default interface VirtualDeviceLogic<
    TAttributes extends DeviceAttributes = DeviceAttributes,
    TConfig extends DeviceConfig = NoDeviceConfig
> {
    refreshData(device: VirtualDevice<TAttributes, TConfig>): Promise<void>;

    configureAttributes(): TAttributes;

    get refreshInterval(): number;
}
