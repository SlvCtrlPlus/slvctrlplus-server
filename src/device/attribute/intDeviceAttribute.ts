import type { DeviceAttributeModifier } from './deviceAttribute.js';
import { Int } from '../../util/numbers.js';
import NumberDeviceAttribute from './numberDeviceAttribute.js';

export type InitializedIntGenericDeviceAttribute = IntDeviceAttribute<true>;

export default class IntDeviceAttribute<IsSet extends boolean = false> extends NumberDeviceAttribute<Int, IsSet>
{
    public static createInitialized(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        uom: string | undefined,
        initialValue: Int,
    ): InitializedIntGenericDeviceAttribute {
        return new IntDeviceAttribute<true>(name, label, modifier, uom, initialValue);
    }

    public static create(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        uom: string | undefined,
    ): IntDeviceAttribute {
        return new IntDeviceAttribute(name, label, modifier, uom, undefined);
    }

    public fromString(value: string): Int {
        const num = parseInt(value, 10);

        if (isNaN(num)) {
            throw new Error(`Could not convert '${value}' to a valid value for ${this.constructor.name}`);
        }

        return Int.from(num);
    }

    public override getType(): string {
        return 'int';
    }
}
