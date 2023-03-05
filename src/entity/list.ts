import {Exclude, Expose} from 'class-transformer';

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
