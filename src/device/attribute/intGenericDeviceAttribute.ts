import GenericDeviceAttribute from "./genericDeviceAttribute.js";
import {Expose} from "class-transformer";

export default class IntGenericDeviceAttribute extends GenericDeviceAttribute {

    @Expose()
    public uom?: string;

    public fromString(value: string): string | number | boolean {
        return Number(value);
    }
}
