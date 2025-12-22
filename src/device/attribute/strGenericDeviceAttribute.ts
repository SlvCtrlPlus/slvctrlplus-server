import GenericDeviceAttribute from "./genericDeviceAttribute.js";

export default class StrGenericDeviceAttribute extends GenericDeviceAttribute<string> {
    public fromString(value: string): string {
        return value;
    }
}
