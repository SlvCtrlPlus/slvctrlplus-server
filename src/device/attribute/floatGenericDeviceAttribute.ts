import GenericDeviceAttribute from "./genericDeviceAttribute.js";

export default class FloatGenericDeviceAttribute extends GenericDeviceAttribute {

    public fromString(value: string): string | number | boolean {
        return Number(value);
    }
}
