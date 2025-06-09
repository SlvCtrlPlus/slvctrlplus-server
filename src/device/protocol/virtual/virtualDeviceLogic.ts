import GenericDeviceAttribute from "../../attribute/genericDeviceAttribute.js";
import VirtualDevice from "./virtualDevice.js";

export default interface VirtualDeviceLogic
{
    refreshData(device: VirtualDevice): Promise<void>;

    configureAttributes(): GenericDeviceAttribute[];

    get getRefreshInterval(): number;
}
