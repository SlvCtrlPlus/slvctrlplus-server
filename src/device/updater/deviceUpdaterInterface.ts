import { AnyDevice, DeviceData } from '../device.js';

export default interface DeviceUpdaterInterface
{
    update(device: AnyDevice, rawData: DeviceData): Promise<void>;
}
