import {Exclude, Expose} from 'class-transformer';

@Exclude()
export default abstract class RuleDefinition
{
    @Expose()
    private readonly id: string;

    @Expose()
    private readonly name: string;

    @Expose()
    protected readonly type: string;

    protected constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }

    public get getId(): string {
        return this.id;
    }

    public get getName(): string {
        return this.name;
    }
}
