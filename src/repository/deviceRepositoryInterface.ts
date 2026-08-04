import { AnyDevice } from '../device/device.js';

type DeviceRepositoryInterface = {
    getAll(): AnyDevice[];

    getById(uuid: string): AnyDevice | null;
};

export default DeviceRepositoryInterface;
