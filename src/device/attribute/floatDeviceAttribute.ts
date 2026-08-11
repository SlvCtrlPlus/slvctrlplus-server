import type { AttributeValue, DeviceAttributeModifier } from './deviceAttribute.js';
import { Float } from '../../util/numbers.js';
import NumberDeviceAttribute from './numberDeviceAttribute.js';

export type InitializedFloatGenericDeviceAttribute = FloatDeviceAttribute<true>;

export default class FloatDeviceAttribute<IsInitialized extends boolean = false> extends NumberDeviceAttribute<Float, IsInitialized>
{
    public constructor(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        uom: string | undefined,
        initialValue: AttributeValue<Float, IsInitialized>,
    ) {
        super(name, label, modifier, uom, initialValue);
    }

    public static createInitialized(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        uom: string | undefined,
        initialValue: Float,
    ): InitializedFloatGenericDeviceAttribute {
        return new FloatDeviceAttribute<true>(name, label, modifier, uom, initialValue);
    }

    public static create(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        uom: string | undefined,
    ): FloatDeviceAttribute {
        return new FloatDeviceAttribute(name, label, modifier, uom, undefined);
    }

    public fromString(value: string): Float {
        const num = parseFloat(value);

        if (isNaN(num)) {
            throw new Error(`Could not convert '${value}' to a valid value for ${this.constructor.name}`);
        }

        return Float.from(num);
    }

    public override getType(): string {
        return 'float';
    }
}
