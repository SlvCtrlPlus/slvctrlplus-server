import { Exclude, Expose } from 'class-transformer';
import type { Float, Int } from '../../util/numbers.js';

export type BaseAttributeValue = string | Int | Float | boolean | null;
export type AttributeValue = BaseAttributeValue | undefined;

export enum DeviceAttributeModifier
{
    readOnly = 'ro',
    readWrite = 'rw',
    writeOnly = 'wo',
}

export const isValidAttributeValue = <V extends BaseAttributeValue, T extends V | undefined = V | undefined>(
    attribute: DeviceAttribute<V, T> | undefined,
    value: unknown,
): value is V => attribute?.isValidValue(value) ?? false;

@Exclude()
export default abstract class DeviceAttribute<
    V extends BaseAttributeValue = BaseAttributeValue,
    T extends V | undefined = V | undefined,
>
{
    @Expose({ name: 'name' })
    private readonly _name: string;

    @Expose({ name: 'label' })
    private readonly _label: string | undefined;

    @Expose({ name: 'modifier' })
    private readonly _modifier: DeviceAttributeModifier;

    @Expose({ name: 'value' })
    private _value: T;

    public constructor(name: string, label: string | undefined, modifier: DeviceAttributeModifier, initialValue: T) {
        this._name = name;
        this._label = label;
        this._modifier = modifier;
        this._value = initialValue;
    }

    public static isInstance<U extends DeviceAttribute>(this: abstract new (...args: never[]) => U, attr: unknown): attr is U {
        return attr instanceof this;
    }

    public get name(): string {
        return this._name;
    }

    public get label(): string | undefined {
        return this._label;
    }

    public get modifier(): DeviceAttributeModifier {
        return this._modifier;
    }

    /**
     * @returns the current value or undefined if it has never been set or read from the device
     */
    public get value(): T {
        return this._value;
    }

    public set value(value: T) {
        this._value = value;
    }

    public hasValue(): this is { value: T } {
        return this._value !== undefined;
    }

    @Expose({ name: 'type' })
    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    public getType(): string {
        throw new Error(`Not implemented`);
    }

    public abstract fromString(value: string): V;

    public abstract isValidValue(value: unknown): value is V;
}
