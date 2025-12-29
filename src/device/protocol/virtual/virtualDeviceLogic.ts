import VirtualDevice from "./virtualDevice.js";
import {DeviceAttributes} from "../../device.js";

export default interface VirtualDeviceLogic<T extends DeviceAttributes = DeviceAttributes>
{
    refreshData(device: VirtualDevice<T>): Promise<void>;

    configureAttributes(): T;

    get getRefreshInterval(): number;
}
