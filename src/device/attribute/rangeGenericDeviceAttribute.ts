import GenericDeviceAttribute from "./genericDeviceAttribute.js";
import {Expose} from "class-transformer";

export default class RangeGenericDeviceAttribute extends GenericDeviceAttribute {
    @Expose()
    public min: number;

    @Expose()
    public max: number;

    public fromString(value: string): string | number | boolean {
        return Number(value);
    }
}
