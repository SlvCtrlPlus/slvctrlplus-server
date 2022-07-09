import {Exclude, Expose} from "class-transformer";
import Device from "../../device/device.js";

@Exclude()
export default abstract class Rule
{
    @Expose()
    protected id: string;

    @Expose()
    protected name: string;

    protected constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }

    public get getId() {
        return this.id;
    }

    public get getName() {
        return this.name;
    }

    public abstract apply(device: Device): void;
}
