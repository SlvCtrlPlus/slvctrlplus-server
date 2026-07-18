import PlainToClassSerializer from '../../serialization/plainToClassSerializer.js';
import DeviceUpdaterInterface from './deviceUpdaterInterface.js';
import { AnyDevice, DeviceData } from '../device.js';

export default abstract class AbstractDeviceUpdater implements DeviceUpdaterInterface
{
    protected serializer: PlainToClassSerializer;

    protected constructor(serializer: PlainToClassSerializer)
    {
        this.serializer = serializer;
    }

    public abstract update(device: AnyDevice, deviceData: DeviceData): Promise<void>;
}
