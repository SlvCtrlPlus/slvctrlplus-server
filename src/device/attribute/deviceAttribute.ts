import { Exclude, Expose } from 'class-transformer';
import type { Float, Int } from '../../util/numbers.js';
import type { TNull, TUndefined, TUnion, TUnsafe } from '@sinclair/typebox';
import { type Static, type TSchema, Type } from '@sinclair/typebox';
import type { TypeCheck } from '@sinclair/typebox/compiler';
import { TypeCompiler } from '@sinclair/typebox/compiler';

export type RequiresValue<S extends TSchema> = S
    & ([Exclude<Static<S>, null | undefined>] extends [never]
        ? 'ERROR: schema must allow a value other than null/undefined'
        : unknown);

// Schema-independent value type used as a type-erasure boundary (see AnyDevice in device.ts).
export type AttributeValue = string | Int | Float | boolean | null | undefined;

export enum DeviceAttributeModifier
{
    readOnly = 'ro',
    readWrite = 'rw',
    writeOnly = 'wo',
}

export const isValidAttributeValue = <T extends AttributeValueSchema>(
    attribute: DeviceAttribute<T> | undefined,
    value: unknown,
): value is Exclude<Static<T>, undefined> => attribute?.isValidValue(value) ?? false;

export type AttributeValueSchema = TSchema;

// Schema for the bare/unparameterized `DeviceAttribute` (see the class's default type parameter
// below): its `.value` resolves to `AttributeValue`, matching the erasure boundary used
// throughout the codebase wherever a heterogeneous collection is typed as `DeviceAttribute`
// without a type argument (e.g. `Record<string, DeviceAttribute>`).
export type AnyAttributeValueSchema = TUnsafe<AttributeValue>;

export type AttributeSchemaOptions = { nullable?: boolean, uninitialized?: boolean };

type IsSet<O, K extends keyof AttributeSchemaOptions> = O extends Record<K, true> ? true : false;

export type WithNullish<S extends TSchema, O> =
    IsSet<O, 'nullable'> extends true
        ? (IsSet<O, 'uninitialized'> extends true ? TUnion<[S, TNull, TUndefined]> : TUnion<[S, TNull]>)
        : (IsSet<O, 'uninitialized'> extends true ? TUnion<[S, TUndefined]> : S);

type AttributeOptions<TInitialValue extends TSchema> = {
    name: string;
    label?: string;
    modifier: DeviceAttributeModifier;
    initialValue: Static<TInitialValue>;
} & AttributeSchemaOptions;

/** Attribute always holds a value. */
export type Initialized = { nullable?: false, uninitialized?: false };
/** Attribute may hold `null` ("no value"). */
export type Nullable = { nullable: true, uninitialized?: false };
/** Attribute may hold `undefined` (never initialized). */
export type Uninitialized = { nullable?: false, uninitialized: true };
/**
 * Attribute may hold `null` or `undefined`.
 * @knipignore completes the presence-marker set for symmetry; no attribute currently needs both
 * nullable and uninitialized, so nothing references this name yet.
 */
export type UninitializedAndNullable = { nullable: true, uninitialized: true };

/** Presence flags inferred from an attribute's `create()` call, e.g. `{ nullable: true }`. */
type PresenceFlags<N extends boolean, U extends boolean> = { nullable?: N, uninitialized?: U };

/**
 * Normalizes a pair of inferred presence flags down to one of the four canonical presence
 * markers above, so e.g. `XDeviceAttribute.create({ nullable: true, ... })` returns
 * `XDeviceAttribute<Nullable>` instead of the class parameterized by the raw flags.
 */
export type MarkerOf<N extends boolean, U extends boolean> =
    N extends true
        ? (U extends true ? UninitializedAndNullable : Nullable)
        : (U extends true ? Uninitialized : Initialized);

/**
 * Options accepted by an attribute's `create()` for a given base value schema `S` and inferred
 * presence flags `N`/`U`. Combines the common name/label/modifier/initialValue shape (with
 * `initialValue` typed for the nullable/uninitialized-adjusted schema) with the raw flags
 * themselves, so `create()` can accept e.g. `{ nullable: true }` and infer `N = true`.
 */
export type AttributeOptionsFor<S extends TSchema, N extends boolean, U extends boolean> =
    AttributeOptions<WithNullish<S, MarkerOf<N, U>>> & PresenceFlags<N, U>;

export function createAttributeSchema<S extends TSchema, const N extends boolean = false, const U extends boolean = false>(
    schema: RequiresValue<S>,
    options?: PresenceFlags<N, U> & AttributeSchemaOptions,
): RequiresValue<WithNullish<S, MarkerOf<N, U>>>;
export function createAttributeSchema<S extends TSchema>(schema: RequiresValue<S>, options: AttributeSchemaOptions = {}): RequiresValue<S> | TUnion<(S | TNull | TUndefined)[]> {
    const parts: (RequiresValue<S> | TNull | TUndefined)[] = [schema];

    if (true === options.nullable) {
        parts.push(Type.Null());
    }

    if (true === options.uninitialized) {
        parts.push(Type.Undefined());
    }

    return 1 === parts.length ? schema : Type.Union(parts);
}

@Exclude()
export default abstract class DeviceAttribute<T extends AttributeValueSchema = AnyAttributeValueSchema>
{
    @Expose({ name: 'name' })
    private readonly _name: string;

    @Expose({ name: 'label' })
    private readonly _label: string | undefined;

    @Expose({ name: 'modifier' })
    private readonly _modifier: DeviceAttributeModifier;

    @Expose({ name: 'value' })
    private _value: Static<T>;

    private readonly schemaBuilder: () => RequiresValue<T>;

    private schemaValidator: TypeCheck<RequiresValue<T>> | undefined;

    public constructor(name: string, label: string | undefined, modifier: DeviceAttributeModifier, schemaBuilder: () => RequiresValue<T>, initialValue: Static<T>) {
        this._name = name;
        this._label = label;
        this._modifier = modifier;
        this._value = initialValue;
        this.schemaBuilder = schemaBuilder;
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

        this.schemaValidator ??= TypeCompiler.Compile(this.schemaBuilder());

        return this.schemaValidator.Check(value);
    }

    protected abstract convertStringToValue(value: string): unknown;
}
