import Device, {DeviceData} from "../device.js";

export default interface DeviceUpdaterInterface
{
    update(device: Device, rawData: DeviceData): Promise<void>;
}
