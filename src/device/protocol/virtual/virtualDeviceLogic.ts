import GenericDeviceAttribute from "../../attribute/genericDeviceAttribute.js";
import VirtualDevice from "./virtualDevice.js";
import {DeviceAttributes} from "../../device";

export default interface VirtualDeviceLogic<T extends DeviceAttributes>
{
    refreshData(device: VirtualDevice<T>): Promise<void>;

    configureAttributes(): T;

    get getRefreshInterval(): number;
}
