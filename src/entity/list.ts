import {Exclude, Expose, Type} from 'class-transformer';
import Device from "../device/device.js";
import DeviceDiscriminator from "../serialization/discriminator/deviceDiscriminator.js";

@Exclude()
export default class List<T>
{
    @Expose()
    private readonly count: number;

    private readonly items: T[];

    public constructor(items: T[])
    {
        this.items = items;
        this.count = items.length;
    }

    public get getCount(): number
    {
        return this.count;
    }

    @Expose({ name: 'items' })
    @Type(() => Device, DeviceDiscriminator.createClassTransformerTypeDiscriminator('type'))
    public get getItems(): T[]
    {
        return this.items;
    }
}
