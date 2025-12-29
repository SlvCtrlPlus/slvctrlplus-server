import {DeviceAttributeModifier, NotJustUndefined} from "./deviceAttribute.js";
import {Int} from "../../util/numbers.js";
import NumberDeviceAttribute from "./numberDeviceAttribute.js";

export type IntAttributeValue = NotJustUndefined<Int | undefined>;
export type InitializedIntGenericDeviceAttribute = IntDeviceAttribute<Int>

export default class IntDeviceAttribute<T extends IntAttributeValue = IntAttributeValue> extends NumberDeviceAttribute<T> {

    public static createInitialized(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        uom: string | undefined,
        initialValue: Int
    ): InitializedIntGenericDeviceAttribute {
        return new IntDeviceAttribute<Int>(name, label, modifier, uom, initialValue);
    }

    public static create(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        uom: string | undefined
    ): IntDeviceAttribute {
        return new IntDeviceAttribute(name, label, modifier, uom, undefined);
    }

    public fromString(value: string): T {
        const num = parseInt(value, 10);

        if (isNaN(num)) {
            throw new Error(`Could not convert '${value}' to a valid value for ${this.constructor.name}`);
        }

        return Int.from(num) as T;
    }

    public getType(): string {
        return 'int';
    }
}
