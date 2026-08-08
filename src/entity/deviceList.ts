import { Exclude, Type } from 'class-transformer';
import type { AnyDevice } from '../device/device.js';
import Device from '../device/device.js';
import List from './list.js';
import deviceDiscriminator from '../serialization/discriminator/deviceDiscriminator.js';

@Exclude()
export default class DeviceList extends List<AnyDevice>
{
    @Type(() => Device, deviceDiscriminator.createClassTransformerTypeDiscriminator('type'))
    protected readonly declare items: AnyDevice[];
}
