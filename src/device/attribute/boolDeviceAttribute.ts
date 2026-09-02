import { Type } from '@sinclair/typebox';
import { createAttributeSchema } from './deviceAttribute.js';
import type { AttributeOptionsFor, AttributeSchemaOptions, Initialized, MarkerOf, WithNullish } from './deviceAttribute.js';
import DeviceAttribute from './deviceAttribute.js';

const boolAttributeValueSchema = Type.Boolean();
type BoolAttributeValueSchema = typeof boolAttributeValueSchema;

export default class BoolDeviceAttribute<O extends AttributeSchemaOptions = Initialized> extends DeviceAttribute<WithNullish<BoolAttributeValueSchema, O>>
{
    public static create<const N extends boolean = false, const U extends boolean = false>(
        options: AttributeOptionsFor<BoolAttributeValueSchema, N, U>,
    ): BoolDeviceAttribute<MarkerOf<N, U>> {
        return new BoolDeviceAttribute(
            options.name, options.label, options.modifier,
            () => createAttributeSchema(boolAttributeValueSchema, options),
            options.initialValue,
        );
    }

    public override getType(): string {
        return 'bool';
    }

    protected override convertStringToValue(value: string): boolean {
        return (value === '1');
    }
}
