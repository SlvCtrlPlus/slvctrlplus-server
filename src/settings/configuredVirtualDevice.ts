import {Exclude, Expose} from "class-transformer";

@Exclude()
export default class ConfiguredVirtualDevice
{
    @Expose()
    public id: string;

    @Expose()
    public serialNo: string;

    @Expose()
    public name: string|null;

    @Expose()
    public type: string;
}
