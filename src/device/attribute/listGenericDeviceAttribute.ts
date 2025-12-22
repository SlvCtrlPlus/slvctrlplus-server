import GenericDeviceAttribute from "./genericDeviceAttribute.js";
import {Expose} from "class-transformer";

export default class ListGenericDeviceAttribute<K extends string|number,V extends string|number> extends GenericDeviceAttribute<K> {
    @Expose()
    public values: Map<K, V>;

    public fromString(value: string): K {
        const parsedInt = parseInt(value, 10);
        return (isNaN(parsedInt) ? value : parsedInt) as K;
    }
}
