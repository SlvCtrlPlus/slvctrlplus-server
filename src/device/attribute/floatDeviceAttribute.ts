import { Type } from '@sinclair/typebox';
import { Float } from '../../util/numbers.js';
import { createAttributeSchema } from './deviceAttribute.js';
import type { AttributeSchemaOptions, Initialized, MarkerOf, WithNullish } from './deviceAttribute.js';
import type { NumberAttributeOptions } from './numberDeviceAttribute.js';
import NumberDeviceAttribute from './numberDeviceAttribute.js';

const floatAttributeValueSchema = Type.Unsafe<Float>(Type.Number());
type FloatAttributeValueSchema = typeof floatAttributeValueSchema;

export default class FloatDeviceAttribute<O extends AttributeSchemaOptions = Initialized> extends NumberDeviceAttribute<WithNullish<FloatAttributeValueSchema, O>>
{
    public static create<const N extends boolean = false, const U extends boolean = false>(
        options: NumberAttributeOptions<FloatAttributeValueSchema, N, U>,
    ): FloatDeviceAttribute<MarkerOf<N, U>> {
        return new FloatDeviceAttribute(
            options.name, options.label, options.modifier, options.uom,
            () => createAttributeSchema(floatAttributeValueSchema, options), options.initialValue,
        );
    }

    public override getType(): string {
        return 'float';
    }

    protected override convertStringToValue(value: string): Float {
        const num = parseFloat(value);

        if (isNaN(num)) {
            throw new Error(`Could not convert '${value}' to a valid value for ${this.constructor.name}`);
        }

        return Float.from(num);
    }
}
