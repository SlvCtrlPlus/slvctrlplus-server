import type { AttributeValue, DeviceAttributeModifier } from './deviceAttribute.js';
import DeviceAttribute from './deviceAttribute.js';
import { Expose } from 'class-transformer';
import type { Float, Int } from '../../util/numbers.js';

export type NumberAttributeValue = Int | Float;

export default abstract class NumberDeviceAttribute<
    V extends NumberAttributeValue = NumberAttributeValue,
    IsInitialized extends boolean = false,
> extends DeviceAttribute<V, IsInitialized>
{
    @Expose({ name: 'uom' })
    private readonly _uom: string | undefined;

    public constructor(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        uom: string | undefined,
        initialValue: AttributeValue<V, IsInitialized>,
    ) {
        super(name, label, modifier, initialValue);
        this._uom = uom;
    }

    public get uom(): string | undefined {
        return this._uom;
    }
}
