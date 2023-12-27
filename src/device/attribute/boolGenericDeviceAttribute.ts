import GenericDeviceAttribute from "./genericDeviceAttribute.js";

export default class BoolGenericDeviceAttribute extends GenericDeviceAttribute {

    public fromString(value: string): string | number | boolean {
        return value === '1';
    }
}
