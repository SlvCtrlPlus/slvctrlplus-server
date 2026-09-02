import { Type } from '@sinclair/typebox';
import { Int } from '../../util/numbers.js';
import { createAttributeSchema } from './deviceAttribute.js';
import type { AttributeSchemaOptions, Initialized, MarkerOf, WithNullish } from './deviceAttribute.js';
import NumberDeviceAttribute from './numberDeviceAttribute.js';
import type { NumberAttributeOptions } from './numberDeviceAttribute.js';

const intAttributeValueSchema = Type.Unsafe<Int>(Type.Integer());
type IntAttributeValueSchema = typeof intAttributeValueSchema;

export default class IntDeviceAttribute<O extends AttributeSchemaOptions = Initialized> extends NumberDeviceAttribute<WithNullish<IntAttributeValueSchema, O>>
{
    public static create<const N extends boolean = false, const U extends boolean = false>(
        options: NumberAttributeOptions<IntAttributeValueSchema, N, U>,
    ): IntDeviceAttribute<MarkerOf<N, U>> {
        return new IntDeviceAttribute(
            options.name, options.label, options.modifier, options.uom,
            () => createAttributeSchema(intAttributeValueSchema, options),
            options.initialValue,
        );
    }

    public override getType(): string {
        return 'int';
    }

    protected override convertStringToValue(value: string): Int {
        const num = parseInt(value, 10);

        if (isNaN(num)) {
            throw new Error(`Could not convert '${value}' to a valid value for ${this.constructor.name}`);
        }

        return Int.from(num);
    }
}
