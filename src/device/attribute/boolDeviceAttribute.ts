import type { DeviceAttributeModifier, NotJustUndefined, NotUndefined } from './deviceAttribute.js';
import DeviceAttribute from './deviceAttribute.js';

type BoolDeviceAttributeValue = NotJustUndefined<boolean | undefined>;

export type InitializedBoolDeviceAttribute = BoolDeviceAttribute<boolean>;

export default class BoolDeviceAttribute<T extends BoolDeviceAttributeValue = BoolDeviceAttributeValue> extends DeviceAttribute<T>
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

    public override fromString(value: string): T {
        // TODO https://github.com/SlvCtrlPlus/slvctrlplus-server/issues/107
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-unsafe-type-assertion
        return (value === '1') as T;
    }

    public override isValidValue(value: unknown): value is NotUndefined<T> {
        return typeof value === 'boolean';
    }

    public override getType(): string {
        return 'bool';
    }
}
