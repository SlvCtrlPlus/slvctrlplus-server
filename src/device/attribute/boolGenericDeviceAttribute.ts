import GenericDeviceAttribute from "./genericDeviceAttribute.js";

export default class BoolGenericDeviceAttribute extends GenericDeviceAttribute<boolean> {

    public fromString(value: string): boolean {
        return value === '1';
    }
}
