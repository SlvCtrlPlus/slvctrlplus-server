import { AnyDevice } from '../device/device.js';

export default interface DeviceRepositoryInterface
{
    getAll(): AnyDevice[];

    getById(uuid: string): AnyDevice|null;
}
