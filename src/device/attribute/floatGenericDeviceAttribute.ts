import GenericDeviceAttribute from "./genericDeviceAttribute.js";

export default class FloatGenericDeviceAttribute extends GenericDeviceAttribute<number> {

    public fromString(value: string): number {
        return Number(value);
    }
}
