import {Exclude, Expose} from "class-transformer";

@Exclude()
export default class DeviceSource
{
    @Expose()
    public id: string;

    @Expose()
    public type: string;

    @Expose()
    public config: JsonObject;
}
