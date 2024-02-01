import {Exclude, Expose} from "class-transformer";
import {JsonObject} from "../types.js";

@Exclude()
export default class KnownDevice
{
    @Expose()
    public id: string;

    @Expose()
    public serialNo: string;

    @Expose()
    public name: string|null;

    @Expose()
    public type: string;

    @Expose()
    public source: string;

    @Expose()
    public config: JsonObject = {};
}
