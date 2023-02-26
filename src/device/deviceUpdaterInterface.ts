import Device from "./device.js";
import type {DeviceData} from "./types.js";

export default interface DeviceUpdaterInterface
{
    update(device: Device, rawData: DeviceData): void;
}
