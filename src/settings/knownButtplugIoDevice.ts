import {Exclude, Expose} from "class-transformer";
import {ButtplugClientDevice} from "buttplug";

@Exclude()
export default class KnownButtplugIoDevice
{
    @Expose()
    public id: string;

    @Expose()
    public index: number;

    @Expose()
    public name: string|null;

    @Expose()
    public type: string;
}
