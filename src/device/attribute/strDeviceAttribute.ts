import type { DeviceAttributeModifier } from './deviceAttribute.js';
import DeviceAttribute from './deviceAttribute.js';

export type InitializedStrDeviceAttribute = StrDeviceAttribute<true>;

export default class StrDeviceAttribute<IsSet extends boolean = false> extends DeviceAttribute<string, IsSet>
{
    public static createInitialized(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        initialValue: string,
    ): InitializedStrDeviceAttribute {
        return new StrDeviceAttribute<true>(name, label, modifier, initialValue);
    }

    public static create(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        initialValue?: string,
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
