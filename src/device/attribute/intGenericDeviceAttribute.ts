import GenericDeviceAttribute from "./genericDeviceAttribute.js";
import {Expose} from "class-transformer";

export default class IntGenericDeviceAttribute extends GenericDeviceAttribute<number> {

    @Expose()
    public uom?: string;

    public fromString(value: string): number {
        return Number(value);
    }
}
