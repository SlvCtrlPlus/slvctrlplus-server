import Device from "./device.js";
import {DeviceData} from "./types";

export default interface DeviceUpdaterInterface
{
    update(device: Device, rawData: DeviceData): void;
}
