import type { DeviceAttributeModifier } from './deviceAttribute.js';
import DeviceAttribute from './deviceAttribute.js';

type StrDeviceAttributeValue = string | undefined;

export type InitializedStrDeviceAttribute = StrDeviceAttribute<string>;

export default class StrDeviceAttribute<T extends StrDeviceAttributeValue = StrDeviceAttributeValue> extends DeviceAttribute<string, T>
{
    public static createInitialized(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        initialValue: string,
    ): InitializedStrDeviceAttribute {
        return new StrDeviceAttribute<string>(name, label, modifier, initialValue);
    }

    public static create(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        initialValue?: StrDeviceAttributeValue,
    ): StrDeviceAttribute {
        return new StrDeviceAttribute(name, label, modifier, initialValue);
    }

    public override fromString(value: string): string {
        return value;
    }

    public override isValidValue(value: unknown): value is string {
        return typeof value === 'string';
    }

    public override getType(): string {
        return 'str';
    }
}
