import { Type } from '@sinclair/typebox';
import { createAttributeSchema } from './deviceAttribute.js';
import type { AttributeOptions, NullishBound, WithNullish } from './deviceAttribute.js';
import DeviceAttribute from './deviceAttribute.js';

const boolAttributeValueSchema = Type.Boolean();
type BoolAttributeValueSchema = typeof boolAttributeValueSchema;
type BoolSchemaFor<O> = WithNullish<BoolAttributeValueSchema, O>;
type BoolAttributeOptions<O> = AttributeOptions<BoolSchemaFor<O>>;

export default class BoolDeviceAttribute<T extends NullishBound<BoolAttributeValueSchema>> extends DeviceAttribute<T>
{
    public static create<const TAttrOptions extends BoolAttributeOptions<TAttrOptions>>(
        options: TAttrOptions,
    ): BoolDeviceAttribute<BoolSchemaFor<TAttrOptions>> {
        return new BoolDeviceAttribute(options.name, options.label, options.modifier, createAttributeSchema(boolAttributeValueSchema, options), options.initialValue);
    }

    public override getType(): string {
        return 'bool';
    }

    protected override convertStringToValue(value: string): boolean {
        return (value === '1');
    }
}
