import { Type } from '@sinclair/typebox';
import { createAttributeSchema } from './deviceAttribute.js';
import type { AttributeOptionsFor, AttributeSchemaOptions, Initialized, MarkerOf, WithNullish } from './deviceAttribute.js';
import DeviceAttribute from './deviceAttribute.js';

const strAttributeValueSchema = Type.String();
type StrAttributeValueSchema = typeof strAttributeValueSchema;

export default class StrDeviceAttribute<O extends AttributeSchemaOptions = Initialized> extends DeviceAttribute<WithNullish<StrAttributeValueSchema, O>>
{
    public static create<const N extends boolean = false, const U extends boolean = false>(
        options: AttributeOptionsFor<StrAttributeValueSchema, N, U>,
    ): StrDeviceAttribute<MarkerOf<N, U>> {
        return new StrDeviceAttribute(
            options.name, options.label, options.modifier,
            () => createAttributeSchema(strAttributeValueSchema, options),
            options.initialValue,
        );
    }

    public override getType(): string {
        return 'str';
    }

    protected override convertStringToValue(value: string): string {
        return value;
    }
}
