import {Exclude, Expose} from "class-transformer";
import {JsonObject} from "../types.js";

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
