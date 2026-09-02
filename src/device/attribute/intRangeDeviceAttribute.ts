import { Expose } from 'class-transformer';
import { Type } from '@sinclair/typebox';
import type { Static, TUnsafe } from '@sinclair/typebox';
import { Int } from '../../util/numbers.js';
import { createAttributeSchema } from './deviceAttribute.js';
import type { AttributeSchemaOptions, DeviceAttributeModifier, Initialized, MarkerOf, RequiresValue, WithNullish } from './deviceAttribute.js';
import type { NumberAttributeOptions } from './numberDeviceAttribute.js';
import NumberDeviceAttribute from './numberDeviceAttribute.js';

const createIntRangeAttributeValueSchema = (options: { min?: Int, max?: Int, incrementStep?: Int }): TUnsafe<Int> => Type.Unsafe<Int>(Type.Integer({
    'minimum': options.min,
    'maximum': options.max,
    'x-increment-step': options.incrementStep,
}));

type IntRangeAttributeValueSchema = ReturnType<typeof createIntRangeAttributeValueSchema>;
type IntRangeSchemaFor<O> = WithNullish<IntRangeAttributeValueSchema, O>;

type IntRangeAttributeOptions<N extends boolean, U extends boolean> =
    NumberAttributeOptions<IntRangeAttributeValueSchema, N, U> & {
        min: Int;
        max: Int;
        incrementStep?: Int;
    };

export default class IntRangeDeviceAttribute<O extends AttributeSchemaOptions = Initialized> extends NumberDeviceAttribute<IntRangeSchemaFor<O>>
{
    @Expose({ name: 'min' })
    private _min: Int;

    @Expose({ name: 'max' })
    private _max: Int;

    @Expose({ name: 'incrementStep' })
    private readonly _incrementStep: Int;

    public constructor(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        uom: string | undefined,
        min: Int,
        max: Int,
        incrementStep: Int,
        schemaBuilder: (options?: { min: Int, max: Int, incrementStep?: Int }) => RequiresValue<IntRangeSchemaFor<O>>,
        initialValue: Static<IntRangeSchemaFor<O>>,
    ) {
        super(name, label, modifier, uom, schemaBuilder, initialValue);
        this._min = min;
        this._max = max;
        this._incrementStep = incrementStep;
    }

    public static create<const N extends boolean = false, const U extends boolean = false>(
        options: IntRangeAttributeOptions<N, U>,
    ): IntRangeDeviceAttribute<MarkerOf<N, U>> {
        return new IntRangeDeviceAttribute(
            options.name, options.label, options.modifier, options.uom,
            options.min, options.max, options.incrementStep ?? Int.from(1),
            () => createAttributeSchema(createIntRangeAttributeValueSchema(options), options),
            options.initialValue,
        );
    }

    public get min(): Int {
        return this._min;
    }

    public set min(value: Int) {
        this._min = value;
    }

    public get max(): Int {
        return this._max;
    }

    public set max(value: Int) {
        this._max = value;
    }

    public get incrementStep(): Int {
        return this._incrementStep;
    }

    public override getType(): string {
        return 'range';
    }

    protected override convertStringToValue(value: string): Int {
        const res = parseInt(value, 10);

        if (isNaN(res)) {
            throw new Error(`Could not convert '${value}' to a valid value for ${this.constructor.name}`);
        }

        return Int.from(res);
    }
}
