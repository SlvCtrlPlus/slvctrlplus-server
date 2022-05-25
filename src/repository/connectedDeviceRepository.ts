import DeviceRepositoryInterface from "./deviceRepositoryInterface.js";
import DeviceManager from "../device/deviceManager.js";
import Device from "../device/device.js";

export default class ConnectedDeviceRepository implements DeviceRepositoryInterface
{
    private readonly deviceManager: DeviceManager;

    public constructor(deviceManager: DeviceManager) {
        this.deviceManager = deviceManager;
    }

    public getAll(): Device[]
    {
        return this.deviceManager.getConnectedDevices;
    }

    public getById(uuid: string): Device | null {
        return this.deviceManager.getConnectedDevice(uuid);
    }
}
