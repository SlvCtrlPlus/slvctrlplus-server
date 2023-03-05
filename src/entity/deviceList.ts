import {Exclude, Expose, Type} from 'class-transformer';
import ObjectTypeOptions from "../serialization/objectTypeOptions.js";
import Device from "../device/device.js";
import List from "./list.js";

@Exclude()
export default class DeviceList extends List<Device>
{
    @Type(() => Device, ObjectTypeOptions.device)
    protected readonly declare items: Device[];
}
