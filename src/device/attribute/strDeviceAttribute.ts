import DeviceAttribute, {DeviceAttributeModifier, NotJustUndefined, NotUndefined} from "./deviceAttribute.js";

type StrDeviceAttributeValue = NotJustUndefined<string | undefined>;
export type InitializedStrDeviceAttribute = StrDeviceAttribute<string>;

export default class StrDeviceAttribute<T extends  StrDeviceAttributeValue = StrDeviceAttributeValue> extends DeviceAttribute<T> {

    public static createInitialized(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        initialValue: string
    ): InitializedStrDeviceAttribute {
        return new StrDeviceAttribute<string>(name, label, modifier, initialValue);
    }

    public static create(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
    ): StrDeviceAttribute {
        return new StrDeviceAttribute(name, label, modifier, undefined);
    }

    public fromString(value: string): T {
        return value as T;
    }

    public isValidValue(value: unknown): value is NotUndefined<T> {
        return typeof value === "string";
    }

    public getType(): string {
        return 'str';
    }
}
