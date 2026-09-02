import { Expose } from 'class-transformer';
import type { Static, TSchema } from '@sinclair/typebox';
import type { AttributeOptionsFor, DeviceAttributeModifier, RequiresValue } from './deviceAttribute.js';
import DeviceAttribute from './deviceAttribute.js';

export type NumberAttributeOptions<S extends TSchema, N extends boolean, U extends boolean> =
    AttributeOptionsFor<S, N, U> & { uom?: string };

export default abstract class NumberDeviceAttribute<T extends TSchema> extends DeviceAttribute<T>
{
    @Expose({ name: 'uom' })
    private readonly _uom: string | undefined;

    public constructor(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        uom: string | undefined,
        schemaBuilder: () => RequiresValue<T>,
        initialValue: Static<T>,
    ) {
        super(name, label, modifier, schemaBuilder, initialValue);
        this._uom = uom;
    }

    public get uom(): string | undefined {
        return this._uom;
    }
}
