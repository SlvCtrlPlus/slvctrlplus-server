import { Exclude, Expose } from 'class-transformer';
import type { Float, Int } from '../../util/numbers.js';
import type { TNull, TUndefined, TUnion } from '@sinclair/typebox';
import { type Static, type TSchema, Type } from '@sinclair/typebox';
import type { TypeCheck } from '@sinclair/typebox/compiler';
import { TypeCompiler } from '@sinclair/typebox/compiler';

export type RequiresValue<S extends TSchema> = S
    & ([Exclude<Static<S>, null | undefined>] extends [never]
        ? 'ERROR: schema must allow a value other than null/undefined'
        : unknown);
export type NotJustUndefined<V> = [V] extends [undefined] ? never : V;
export type NotUndefined<V> = V extends undefined ? never : V;
export type NullishBound<S extends TSchema> = S | TUnion<[S, TNull]> | TUnion<[S, TUndefined]> | TUnion<[S, TNull, TUndefined]>;
export type AttributeValue = NotJustUndefined<string | Int | Float | boolean | null | undefined>;

export enum DeviceAttributeModifier
{
    readOnly = 'ro',
    readWrite = 'rw',
    writeOnly = 'wo',
}

export const isValidAttributeValue = <T extends AttributeValueSchema>(
    attribute: DeviceAttribute<T> | undefined,
    value: unknown,
): value is NotUndefined<T> => attribute?.isValidValue(value) ?? false;

export type AttributeValueSchema = TSchema;

export type AttributeSchemaOptions = { nullable?: boolean, optional?: boolean };

type IsSet<O, K extends keyof AttributeSchemaOptions> = O extends Record<K, true> ? true : false;

export type WithNullish<S extends TSchema, O> =
    IsSet<O, 'nullable'> extends true
        ? (IsSet<O, 'optional'> extends true ? TUnion<[S, TNull, TUndefined]> : TUnion<[S, TNull]>)
        : (IsSet<O, 'optional'> extends true ? TUnion<[S, TUndefined]> : S);

export type AttributeOptions<TInitialValue extends TSchema> = {
    name: string;
    label?: string;
    modifier: DeviceAttributeModifier;
    initialValue: Static<TInitialValue>;
} & AttributeSchemaOptions;

export function createAttributeSchema<S extends TSchema, const O extends AttributeSchemaOptions = AttributeSchemaOptions>(
    schema: RequiresValue<S>,
    options?: O,
): RequiresValue<WithNullish<S, O>>;
export function createAttributeSchema(schema: TSchema, options: AttributeSchemaOptions = {}): TSchema {
    const parts: TSchema[] = [schema];

    if (true === options.nullable) {
        parts.push(Type.Null());
    }

    if (true === options.optional) {
        parts.push(Type.Undefined());
    }

    return 1 === parts.length ? schema : Type.Union(parts);
}

@Exclude()
export default abstract class DeviceAttribute<T extends AttributeValueSchema = AttributeValueSchema>
{
    @Expose({ name: 'name' })
    private readonly _name: string;

    @Expose({ name: 'label' })
    private readonly _label: string | undefined;

    @Expose({ name: 'modifier' })
    private readonly _modifier: DeviceAttributeModifier;

    @Expose({ name: 'value' })
    private _value: Static<T>;

    private readonly valueCheck: TypeCheck<RequiresValue<T>>;

    protected constructor(name: string, label: string | undefined, modifier: DeviceAttributeModifier, schema: RequiresValue<T>, initialValue: Static<T>) {
        this._name = name;
        this._label = label;
        this._modifier = modifier;
        this._value = initialValue;
        this.valueCheck = TypeCompiler.Compile(schema);
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
    // eslint-disable-next-line @typescript-eslint/related-getter-setter-pairs
    public get value(): Static<T> {
        return this._value;
    }

    public set value(value: Exclude<Static<T>, undefined>) {
        this._value = value;
    }

    public hasValue(): this is { value: Exclude<Static<T>, undefined> } {
        return this._value !== undefined;
    }

    @Expose({ name: 'type' })
    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    public getType(): string {
        throw new Error(`Not implemented`);
    }

    public fromString(value: string): Exclude<Static<T>, undefined> {
        const tempValue = this.convertStringToValue(value);

        if (!this.isValidValue(tempValue)) {
            throw new Error(`Invalid value for attribute ${this.name}: ${value}`);
        }

        return tempValue;
    }

    public isValidValue(value: unknown): value is Exclude<Static<T>, undefined> {
        if (value === undefined) {
            return false;
        }

        return this.valueCheck.Check(value);
    }

    protected abstract convertStringToValue(value: string): unknown;
}
