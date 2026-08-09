import type { DeviceAttributeModifier } from './deviceAttribute.js';
import DeviceAttribute from './deviceAttribute.js';

export type InitializedBoolDeviceAttribute = BoolDeviceAttribute<true>;

export default class BoolDeviceAttribute<IsSet extends boolean = false> extends DeviceAttribute<boolean, IsSet>
{
    public static createInitialized(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        initialValue: boolean,
    ): InitializedBoolDeviceAttribute {
        return new BoolDeviceAttribute<true>(name, label, modifier, initialValue);
    }

    public static create(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
    ): BoolDeviceAttribute {
        return new BoolDeviceAttribute(name, label, modifier, undefined);
    }

    public override fromString(value: string): boolean {
        return value === '1';
    }

    public override isValidValue(value: unknown): value is boolean {
        return typeof value === 'boolean';
    }

    public override getType(): string {
        return 'bool';
    }
}
