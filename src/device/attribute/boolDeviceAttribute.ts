import DeviceAttribute, {DeviceAttributeModifier, NotJustUndefined, NotUndefined} from "./deviceAttribute.js";

type BoolDeviceAttributeValue = NotJustUndefined<boolean | undefined>;
export type InitializedBoolDeviceAttribute = BoolDeviceAttribute<boolean>

export default class BoolDeviceAttribute<T extends BoolDeviceAttributeValue = BoolDeviceAttributeValue> extends DeviceAttribute<T> {

    public static createInitialized(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        initialValue: boolean
    ): InitializedBoolDeviceAttribute {
        return new BoolDeviceAttribute<boolean>(name, label, modifier, initialValue);
    }

    public static create(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
    ): BoolDeviceAttribute {
        return new BoolDeviceAttribute(name, label, modifier, undefined);
    }

    public fromString(value: string): T {
        return (value === '1') as T;
    }

    public isValidValue(value: unknown): value is NotUndefined<T> {
        return typeof value === "boolean";
    }
}
