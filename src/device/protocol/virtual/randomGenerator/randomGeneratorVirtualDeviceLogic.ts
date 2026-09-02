import { DeviceAttributeModifier } from '../../../attribute/deviceAttribute.js';
import IntDeviceAttribute from '../../../attribute/intDeviceAttribute.js';
import type { Nullable } from '../../../attribute/deviceAttribute.js';
import VirtualDeviceLogic from '../virtualDeviceLogic.js';
import type VirtualDevice from '../virtualDevice.js';
import { Int } from '../../../../util/numbers.js';
import type { RandomGeneratorVirtualDeviceConfig } from './randomGeneratorVirtualDeviceConfig.js';

type RandomGeneratorVirtualDeviceAttributes = {
    value: IntDeviceAttribute<Nullable>;
};

export default class RandomGeneratorVirtualDeviceLogic extends VirtualDeviceLogic<
    RandomGeneratorVirtualDeviceAttributes,
    RandomGeneratorVirtualDeviceConfig
> {
    private static readonly REFRESH_INTERVAL_MS = 100;

    public constructor(config: RandomGeneratorVirtualDeviceConfig) {
        super(config);

        if (config.min >= config.max) {
            throw new Error(
                `Invalid random generator config: min (${config.min}) must be less than max (${config.max})`,
            );
        }
    }

    public override get refreshInterval(): number {
        return RandomGeneratorVirtualDeviceLogic.REFRESH_INTERVAL_MS;
    }

    public async refreshData(device: VirtualDevice<RandomGeneratorVirtualDeviceLogic>): Promise<void> {
        const currentNumber = (await device.getAttribute('value'))?.value;
        let newNumber: number;

        do {
            newNumber = Math.floor(Math.random() * (this.config.max - this.config.min + 1)) + this.config.min;
        } while (null !== currentNumber && undefined !== currentNumber && newNumber === currentNumber);

        await device.setAttribute('value', Int.from(newNumber));
    }

    public override configureAttributes(): RandomGeneratorVirtualDeviceAttributes {
        const valueAttr = IntDeviceAttribute.create({
            name: 'value', label: 'Random number', modifier: DeviceAttributeModifier.readOnly,
            nullable: true, initialValue: null,
        });

        return {
            value: valueAttr,
        };
    }
}
