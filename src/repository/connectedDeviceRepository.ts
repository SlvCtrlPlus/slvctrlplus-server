import type DeviceRepositoryInterface from './deviceRepositoryInterface.js';
import type DeviceManager from '../device/deviceManager.js';
import type { AnyDevice } from '../device/device.js';
import type { DeviceId } from '../device/deviceId.js';

export default class ConnectedDeviceRepository implements DeviceRepositoryInterface
{
    private readonly deviceManager: DeviceManager;

    public constructor(deviceManager: DeviceManager) {
        this.deviceManager = deviceManager;
    }

    public getAll(): AnyDevice[]
    {
        return this.deviceManager.getConnectedDevices();
    }

    public getById(uuid: DeviceId): AnyDevice | null {
        return this.deviceManager.getConnectedDevice(uuid);
    }
}
