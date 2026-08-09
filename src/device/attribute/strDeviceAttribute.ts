import type { DeviceAttributeModifier, NotJustUndefined, NotUndefined } from './deviceAttribute.js';
import DeviceAttribute from './deviceAttribute.js';

type StrDeviceAttributeValue = NotJustUndefined<string | undefined>;

export type InitializedStrDeviceAttribute = StrDeviceAttribute<string>;

export default class StrDeviceAttribute<T extends StrDeviceAttributeValue = StrDeviceAttributeValue> extends DeviceAttribute<T>
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

    public override fromString(value: string): T {
        // TODO https://github.com/SlvCtrlPlus/slvctrlplus-server/issues/107
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-unsafe-type-assertion
        return value as T;
    }

    public override isValidValue(value: unknown): value is NotUndefined<T> {
        return typeof value === 'string';
    }

    public override getType(): string {
        return 'str';
    }
}
