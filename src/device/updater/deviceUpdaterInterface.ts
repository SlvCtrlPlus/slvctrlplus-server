import { AnyDevice, DeviceData } from '../device.js';

type DeviceUpdaterInterface = {
    update(device: AnyDevice, rawData: DeviceData): Promise<void>;
}
export default DeviceUpdaterInterface
