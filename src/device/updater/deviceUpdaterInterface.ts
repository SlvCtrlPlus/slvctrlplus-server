import type { AnyDevice, DeviceData, DeviceDataUpdateResult } from '../device.js';

type DeviceUpdaterInterface = {
    update: (device: AnyDevice, data: DeviceData) => Promise<DeviceDataUpdateResult>;
};

export default DeviceUpdaterInterface;
