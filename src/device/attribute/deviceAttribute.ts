import {Exclude, Expose} from "class-transformer";
import {Float, Int} from "../../util/numbers.js";

export type NotJustUndefined<V> = [V] extends [undefined] ? never : V;
export type NotUndefined<V> = V extends undefined ? never : V;
export type AttributeValue = NotJustUndefined<string | Int | Float | boolean | null | undefined>;

export enum DeviceAttributeModifier {
    readOnly = "ro",
    readWrite = "rw",
    writeOnly = "wo"
}

@Exclude()
export default abstract class DeviceAttribute<T extends AttributeValue = AttributeValue> {
    @Expose()
    private readonly type: string|undefined = undefined; // This field is only here to expose it explicitly

    @Expose({ name: "name" })
    private readonly _name: string;

    @Expose({ name: "label" })
    private readonly _label: string|undefined;

    @Expose({ name: "modifier" })
    private readonly _modifier: DeviceAttributeModifier;

    @Expose({ name: "value" })
    private _value: T;

    public constructor(name: string, label: string|undefined, modifier: DeviceAttributeModifier, initialValue: T) {
        this._name = name;
        this._label = label;
        this._modifier = modifier;
        this._value = initialValue;
    }

    public get name(): string {
        return this._name;
    }

    public get label(): string|undefined {
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

    public abstract fromString(value: string): T;

    public abstract isValidValue(value: unknown): value is NotUndefined<T>;

    public static isInstance<U extends DeviceAttribute>(this: new (...args: any[]) => U, attr: unknown): attr is U {
        return attr instanceof this;
    }
}
