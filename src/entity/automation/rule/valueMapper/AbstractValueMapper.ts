import {Exclude, Expose} from "class-transformer";

@Exclude()
export default abstract class AbstractValueMapper
{
    @Expose()
    protected readonly type: string;
}
