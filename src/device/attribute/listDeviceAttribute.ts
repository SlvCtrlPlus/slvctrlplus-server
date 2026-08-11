import { Expose } from 'class-transformer';
import type { AttributeValue, DeviceAttributeModifier } from './deviceAttribute.js';
import DeviceAttribute from './deviceAttribute.js';
import type { Int } from '../../util/numbers.js';

type ListDeviceAttributeOption<IKey, IValue> = { key: IKey, value: IValue };

export type ListDeviceAttributeItem = string | Int;
export type InitializedListDeviceAttribute<
    IKey extends ListDeviceAttributeItem,
    IValue extends ListDeviceAttributeItem,
> = ListDeviceAttribute<IKey, IValue, true>;

export type ListDeviceAttributeOptions<IKey, IValue> = ListDeviceAttributeOption<IKey, IValue>[];

export default class ListDeviceAttribute<
    IKey extends ListDeviceAttributeItem,
    IValue extends ListDeviceAttributeItem,
    IsInitialized extends boolean = false,
> extends DeviceAttribute<IKey, IsInitialized>
{
    @Expose({ name: 'values' })
    private _values: ListDeviceAttributeOptions<IKey, IValue>;

    public constructor(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        values: ListDeviceAttributeOptions<IKey, IValue>,
        initialValue: AttributeValue<IKey, IsInitialized>,
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
        return new ListDeviceAttribute<IKey, IValue, true>(
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

    public fromString(value: string): IKey {
        if (this._values.length === 0 || typeof this._values[0]?.key === 'string') {
            // The value kind (IKey) is chosen by the caller per instance, so TypeScript can't
            // prove `value`/the parsed number is an IKey here - see issue #107 for details.
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-unsafe-type-assertion
            return value as IKey;
        }

        const parsedInt = parseInt(value, 10);

        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-unsafe-type-assertion
        return (isNaN(parsedInt) ? value : parsedInt) as IKey;
    }

    public get values(): ListDeviceAttributeOptions<IKey, IValue> {
        return this._values;
    }

    public set values(value: ListDeviceAttributeOptions<IKey, IValue>) {
        this._values = value;
    }

    public isValidValue(value: unknown): value is IKey {
        if (typeof value === 'string' || typeof value === 'number') {
            return -1 !== this._values.findIndex(entry => entry.key === value);
        }
        return false;
    }

    public override getType(): string {
        return 'list';
    }
}
