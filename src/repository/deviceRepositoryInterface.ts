import Device from "../device/device.js";

export default interface DeviceRepositoryInterface
{
    getAll(): Device[];

    getById(uuid: string): Device|null;
}
