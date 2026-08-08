import { Expose } from 'class-transformer';
import type { DeviceAttributeModifier, NotUndefined } from './deviceAttribute.js';
import DeviceAttribute from './deviceAttribute.js';
import type { Int } from '../../util/numbers.js';

type ListDeviceAttributeOption<IKey, IValue> = { key: IKey, value: IValue };

export type ListDeviceAttributeItem = string | Int;
export type InitializedListDeviceAttribute<
    IKey extends ListDeviceAttributeItem,
    IValue extends ListDeviceAttributeItem,
> = ListDeviceAttribute<IKey, IValue, IKey>;

export type ListDeviceAttributeOptions<IKey, IValue> = ListDeviceAttributeOption<IKey, IValue>[];

export default class ListDeviceAttribute<
    IKey extends ListDeviceAttributeItem,
    IValue extends ListDeviceAttributeItem,
    V extends IKey | undefined = IKey | undefined,
> extends DeviceAttribute<V>
{
    @Expose({ name: 'values' })
    private _values: ListDeviceAttributeOptions<IKey, IValue>;

    public constructor(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        values: ListDeviceAttributeOptions<IKey, IValue>,
        initialValue: V,
    ) {
        super(name, label, modifier, initialValue);

        this._values = values;
    }

    public static createInitialized<IKey extends ListDeviceAttributeItem, IValue extends ListDeviceAttributeItem>(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        values: ListDeviceAttributeOptions<IKey, IValue>,
        initialValue: IKey,
    ): InitializedListDeviceAttribute<IKey, IValue> {
        return new ListDeviceAttribute<IKey, IValue, IKey>(
            name, label, modifier, values, initialValue,
        );
    }

    public static create<IKey extends ListDeviceAttributeItem, IValue extends ListDeviceAttributeItem>(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        values: ListDeviceAttributeOptions<IKey, IValue>,
    ): ListDeviceAttribute<IKey, IValue> {
        return new ListDeviceAttribute<IKey, IValue>(
            name, label, modifier, values, undefined,
        );
    }

    public fromString(value: string): V {
        if (this._values.length === 0 || typeof this._values[0]?.key === 'string') {
            // TODO https://github.com/SlvCtrlPlus/slvctrlplus-server/issues/107
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-unsafe-type-assertion
            return value as V;
        }

        const parsedInt = parseInt(value, 10);

        // TODO https://github.com/SlvCtrlPlus/slvctrlplus-server/issues/107
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-unsafe-type-assertion
        return (isNaN(parsedInt) ? value : parsedInt) as V;
    }

    public get values(): ListDeviceAttributeOptions<IKey, IValue> {
        return this._values;
    }

    public set values(value: ListDeviceAttributeOptions<IKey, IValue>) {
        this._values = value;
    }

    public isValidValue(value: unknown): value is NotUndefined<V> {
        if (typeof value === 'string' || typeof value === 'number') {
            return -1 !== this._values.findIndex(entry => entry.key === value);
        }
        return false;
    }

    public override getType(): string {
        return 'list';
    }
}
