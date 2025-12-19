import Device, {DeviceData} from "../device/device.js";

export default interface DeviceRepositoryInterface
{
    getAll(): Device<DeviceData>[];

    getById(uuid: string): Device<DeviceData>|null;
}
