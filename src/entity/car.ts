import { Exclude, Expose } from 'class-transformer';

@Exclude()
export default class Car
{
    @Expose()
    private readonly id: string;

    @Expose()
    private readonly maker: string;

    @Expose()
    private readonly model: string;

    private readonly owner: string | null;

    public constructor(id: string, maker: string, model: string, owner: string | null)
    {
        this.id = id;
        this.maker = maker;
        this.model = model;
        this.owner = owner;
    }

    public getId(): string
    {
        return this.id;
    }

    public getMaker(): string
    {
        return this.maker;
    }

    public getModel(): string
    {
        return this.model;
    }

    public getOwner(): string | null
    {
        return this.owner;
    }
}
