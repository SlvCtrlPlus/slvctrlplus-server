import VirtualDevice from "./virtualDevice.js";
import {DeviceAttributes} from "../../device";

export default interface VirtualDeviceLogic<T extends DeviceAttributes = DeviceAttributes>
{
    refreshData(device: VirtualDevice): Promise<void>;

    configureAttributes(): T;

    get getRefreshInterval(): number;
}
