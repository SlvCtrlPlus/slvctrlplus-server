import { Expose } from 'class-transformer';
import { Type } from '@sinclair/typebox';
import type { TUnsafe } from '@sinclair/typebox';
import type { DeviceAttributeModifier, RequiresValue } from './deviceAttribute.js';
import DeviceAttribute from './deviceAttribute.js';
import type { Int } from '../../util/numbers.js';

type ListDeviceAttributeOption<IKey, IValue> = { key: IKey, value: IValue };

export type ListDeviceAttributeItem = string | Int;
export type InitializedListDeviceAttribute<
    IKey extends ListDeviceAttributeItem,
    IValue extends ListDeviceAttributeItem,
> = ListDeviceAttribute<IKey, IValue, IKey>;

export type ListDeviceAttributeOptions<IKey, IValue> = ListDeviceAttributeOption<IKey, IValue>[];

// ListDeviceAttribute's valid values are chosen per-instance from `values` (runtime data), not a
// fixed schema, and `values` is mutable via a public setter - so unlike the other attribute types
// it cannot express its value domain as a static TypeBox schema without the compiled validator
// going stale on mutation. It stays on a permissive `TUnsafe<V>` schema (no TypeBox-level
// validation) and keeps doing membership checking itself in isValidValue, as before.
export default class ListDeviceAttribute<
    IKey extends ListDeviceAttributeItem,
    IValue extends ListDeviceAttributeItem,
    V extends IKey | undefined = IKey | undefined,
> extends DeviceAttribute<TUnsafe<V>>
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
        // `V` is this class's own open generic, and structurally excludes null/undefined
        // (IKey extends ListDeviceAttributeItem, which never includes them) - but TypeScript
        // can't prove that while V stays open, so RequiresValue<TUnsafe<V>> stays an unresolved
        // conditional at this call site. The schema carries no real validation here anyway
        // (see class comment), so this is the single, deliberate exception to the "no type
        // assertions" rule for this file.
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-unsafe-type-assertion
        super(name, label, modifier, () => Type.Unsafe<V>(Type.Unknown()) as RequiresValue<TUnsafe<V>>, initialValue);

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

    public get values(): ListDeviceAttributeOptions<IKey, IValue> {
        return this._values;
    }

    public set values(value: ListDeviceAttributeOptions<IKey, IValue>) {
        this._values = value;
    }

    public override isValidValue(value: unknown): value is Exclude<V, undefined> {
        if (typeof value === 'string' || typeof value === 'number') {
            return -1 !== this._values.findIndex(entry => entry.key === value);
        }
        return false;
    }

    public override getType(): string {
        return 'list';
    }

    protected override convertStringToValue(value: string): unknown {
        if (this._values.length === 0 || typeof this._values[0]?.key === 'string') {
            return value;
        }

        const parsedInt = parseInt(value, 10);

        return isNaN(parsedInt) ? value : parsedInt;
    }
}
