import type { DeviceAttributeModifier } from './deviceAttribute.js';
import DeviceAttribute from './deviceAttribute.js';

type BoolDeviceAttributeValue = boolean | undefined;

export type InitializedBoolDeviceAttribute = BoolDeviceAttribute<boolean>;

export default class BoolDeviceAttribute<T extends BoolDeviceAttributeValue = BoolDeviceAttributeValue> extends DeviceAttribute<boolean, T>
{
    public static createInitialized(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        initialValue: boolean,
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
