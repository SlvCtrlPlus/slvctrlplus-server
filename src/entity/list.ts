import {Exclude, Expose, Type} from 'class-transformer';
import ObjectTypeOptions from "../serialization/objectTypeOptions.js";
import Device from "../device/device.js";

@Exclude()
export default class List<T>
{
    @Expose()
    private readonly count: number;

    @Expose()
    protected readonly items: T[];

    public constructor(items: T[])
    {
        this.items = items;
        this.count = items.length;
    }

    public get getCount(): number
    {
        return this.count;
    }

    public get getItems(): T[]
    {
        return this.items;
    }
}
