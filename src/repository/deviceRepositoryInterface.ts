import type { AnyDevice } from '../device/device.js';
import type { DeviceId } from '../device/deviceId.js';

type DeviceRepositoryInterface = {
    getAll: () => AnyDevice[];

    getById: (uuid: DeviceId) => AnyDevice | null;
};

export default DeviceRepositoryInterface;
