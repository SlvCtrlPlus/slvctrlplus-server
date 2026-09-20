import { Expose } from 'class-transformer';
import { TypeGuard, type Static, type TSchema } from '@sinclair/typebox';
import type { RangeBounds } from './deviceAttributeSchema.js';
import { nullable, rangeIntSchema, uninitialized } from './deviceAttributeSchema.js';
import type { AttributeOptions, RequiresValue, SchemaOf } from './deviceAttribute.js';
import { DeviceAttributeModifier } from './deviceAttribute.js';
import type DeviceAttribute from './deviceAttribute.js';
import type { NumberAttributeOptions, NumberMemberSchema } from './numberDeviceAttribute.js';
import NumberDeviceAttribute from './numberDeviceAttribute.js';
import { Int } from '../../util/numbers.js';

export type ValueOf<T extends TSchema> = Exclude<Static<T>, null | undefined>;

export default class RangeDeviceAttribute<T extends NumberMemberSchema> extends NumberDeviceAttribute<T>
{
    @Expose({ name: 'min' })
    private readonly _min: ValueOf<T>;

    @Expose({ name: 'max' })
    private readonly _max: ValueOf<T>;

    @Expose({ name: 'incrementStep' })
    private readonly _incrementStep: ValueOf<T>;

    public constructor(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        uom: string | undefined,
        schema: RequiresValue<SchemaOf<T>>,
        initialValue: Static<T>,
    ) {
        super(name, label, modifier, uom, schema, initialValue);

        const bounds = this.extractBounds(schema);
        this._min = bounds.minimum;
        this._max = bounds.maximum;
        this._incrementStep = bounds['x-increment-step'];
    }

    public static override create<S extends NumberMemberSchema>(options: NumberAttributeOptions<S>): RangeDeviceAttribute<S>;
    public static override create<S extends TSchema>(options: AttributeOptions<S>): DeviceAttribute<S>;
    public static override create<S extends TSchema & NumberMemberSchema>(options: NumberAttributeOptions<S>): RangeDeviceAttribute<S> {
        return new RangeDeviceAttribute(
            options.name, options.label, options.modifier, options.uom, options.schema, options.initialValue,
        );
    }

    public get min(): ValueOf<T> {
        return this._min;
    }

    public get max(): ValueOf<T> {
        return this._max;
    }

    public get incrementStep(): ValueOf<T> {
        return this._incrementStep;
    }

    public override getType(): string {
        return 'range';
    }

    private extractBounds(schema: RequiresValue<SchemaOf<T>>): RangeBounds<ValueOf<T>> {
        const results: RangeBounds<ValueOf<T>>[] = [];

        const walk = (node: TSchema): void => {
            if (this.hasRangeBounds(node)) {
                results.push({
                    'minimum': node.minimum,
                    'maximum': node.maximum,
                    'x-increment-step': node['x-increment-step'],
                });
            }
            if (TypeGuard.IsUnion(node)) {
                for (const member of node.anyOf) {
                    walk(member);
                }
            }
        };

        walk(schema);

        if (results.length > 1) {
            throw new Error('Schema contains multiple range bounds — ambiguous');
        }

        const bounds = results[0];

        if (bounds === undefined) {
            throw new Error('Schema does not contain range bounds (minimum/maximum/x-increment-step)');
        }

        return bounds;
    }

    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    private hasRangeBounds(schema: TSchema): schema is RequiresValue<SchemaOf<T>> & RangeBounds<ValueOf<T>> {
        return 'minimum' in schema && 'maximum' in schema && 'x-increment-step' in schema;
    }
}

// eslint-disable-next-line @typescript-eslint/no-magic-numbers
const foo = nullable(uninitialized(rangeIntSchema({ min: Int.from(0), max: Int.from(100), incrementStep: Int.from(1) })));

const attr = RangeDeviceAttribute.create({
    name: 'test',
    label: 'Test',
    modifier: DeviceAttributeModifier.readWrite,
    uom: 'units',
    schema: foo,
    initialValue: undefined,
});

type Foo = Static<typeof foo>;
