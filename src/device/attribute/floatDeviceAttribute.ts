import {DeviceAttributeModifier, NotJustUndefined} from "./deviceAttribute";
import {Float} from "../../util/numbers.js";
import NumberDeviceAttribute from "./numberDeviceAttribute.js";

type FloatDeviceAttributeValue = NotJustUndefined<Float | undefined>;
export type InitializedFloatGenericDeviceAttribute = FloatDeviceAttribute<Float>;

export default class FloatDeviceAttribute<T extends FloatDeviceAttributeValue = FloatDeviceAttributeValue> extends NumberDeviceAttribute<T> {

    public constructor(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        uom: string | undefined,
        initialValue: T
    ) {
        super(name, label, modifier, uom, initialValue);
    }

    public static createInitialized(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        uom: string | undefined,
        initialValue: Float
    ): InitializedFloatGenericDeviceAttribute {
        return new FloatDeviceAttribute<Float>(name, label, modifier, uom, initialValue);
    }

    public static create(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        uom: string | undefined
    ): FloatDeviceAttribute {
        return new FloatDeviceAttribute(name, label, modifier, uom, undefined);
    }

    public fromString(value: string): T {
        const num = parseFloat(value);

        if (isNaN(num)) {
            throw new Error(`Could not convert '${value}' to a valid value for ${this.constructor.name}`);
        }

        return Float.from(num) as T;
    }

    public getType(): string {
        return 'float';
    }
}
