import GenericDeviceAttribute from "./genericDeviceAttribute.js";
import {Expose} from "class-transformer";

export default class ListGenericDeviceAttribute extends GenericDeviceAttribute {
    @Expose()
    public values: Map<string|number, string|number>;
}
