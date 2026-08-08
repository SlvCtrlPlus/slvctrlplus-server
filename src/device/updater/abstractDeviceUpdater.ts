import type PlainToClassSerializer from '../../serialization/plainToClassSerializer.js';
import type DeviceUpdaterInterface from './deviceUpdaterInterface.js';
import type { AnyDevice, DeviceData } from '../device.js';

export default abstract class AbstractDeviceUpdater implements DeviceUpdaterInterface
{
    protected serializer: PlainToClassSerializer;

    protected constructor(serializer: PlainToClassSerializer)
    {
        this.serializer = serializer;
    }

    public abstract update(device: AnyDevice, deviceData: DeviceData): Promise<void>;
}
