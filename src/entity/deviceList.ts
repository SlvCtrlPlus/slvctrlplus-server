import {Exclude, Type} from 'class-transformer';
import Device from "../device/device.js";
import List from "./list.js";
import DeviceDiscriminator from "../serialization/discriminator/deviceDiscriminator.js";

@Exclude()
export default class DeviceList extends List<Device>
{
    @Type(() => Device, DeviceDiscriminator.createClassTransformerTypeDiscriminator('type'))
    protected readonly declare items: Device[];
}
