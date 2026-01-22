import { Expose } from 'class-transformer';
import DeviceAttribute, { DeviceAttributeModifier, NotUndefined } from './deviceAttribute.js';
import { Int } from '../../util/numbers.js';

export type ListDeviceAttributeItem = string | Int;
export type InitializedListDeviceAttribute<
    IKey extends ListDeviceAttributeItem,
    IValue extends ListDeviceAttributeItem
> = ListDeviceAttribute<IKey, IValue, IKey>;

export default class ListDeviceAttribute<
    IKey extends ListDeviceAttributeItem,
    IValue extends ListDeviceAttributeItem,
    V extends IKey | undefined = IKey | undefined
> extends DeviceAttribute<V>
{
    @Expose({ name: 'values' })
    private _values: Map<IKey, IValue> = new Map();

    public constructor(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        values: Map<IKey, IValue>,
        initialValue: V
    ) {
        super(name, label, modifier, initialValue);

        this._values = values;
    }

    public static createInitialized<IKey extends ListDeviceAttributeItem, IValue extends ListDeviceAttributeItem>(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        values: Map<IKey, IValue>,
        initialValue: IKey
    ): InitializedListDeviceAttribute<IKey, IValue> {
        return new ListDeviceAttribute<IKey, IValue, IKey>(
            name, label, modifier, values, initialValue
        );
    }

    public static create<IKey extends ListDeviceAttributeItem, IValue extends ListDeviceAttributeItem>(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        values: Map<IKey, IValue>
    ): ListDeviceAttribute<IKey, IValue> {
        return new ListDeviceAttribute<IKey, IValue>(
            name, label, modifier, values, undefined
        );
    }

    public fromString(value: string): V {
        if (this._values.size === 0 || typeof this._values.keys().next().value === 'string') {
            return value as V;
        }

        const parsedInt = parseInt(value, 10);
        return (isNaN(parsedInt) ? value : parsedInt) as V;
    }

    public get values(): Map<IKey, IValue> {
        return this._values;
    }

    public set values(value: Map<IKey, IValue>) {
        this._values = value;
    }

    public isValidValue(value: unknown): value is NotUndefined<V> {
        console.log(this._values, value)
        if (typeof value === 'string' || typeof value === 'number') {
            return this._values.has(value as IKey);
        }
        return false;
    }

    public getType(): string {
        return 'list';
    }
}
