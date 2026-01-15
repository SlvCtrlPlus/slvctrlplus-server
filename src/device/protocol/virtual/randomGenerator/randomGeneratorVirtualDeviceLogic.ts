import { DeviceAttributeModifier } from '../../../attribute/deviceAttribute.js';
import IntDeviceAttribute from '../../../attribute/intDeviceAttribute.js';
import VirtualDeviceLogic from '../virtualDeviceLogic.js';
import VirtualDevice from '../virtualDevice.js';
import { Int } from '../../../../util/numbers.js';
import { RandomGeneratorVirtualDeviceConfig } from './randomGeneratorVirtualDeviceConfig.js';

type RandomGeneratorVirtualDeviceAttributes = {
    value: IntDeviceAttribute;
}

export default class RandomGeneratorVirtualDeviceLogic extends VirtualDeviceLogic<
    RandomGeneratorVirtualDeviceAttributes,
    RandomGeneratorVirtualDeviceConfig
> {
    public constructor(config: RandomGeneratorVirtualDeviceConfig) {
        super(config);

        if (config.min >= config.max) {
            throw new Error(
                `Invalid random generator config: min (${config.min}) must be less than max (${config.max})`
            );
        }
    }

    public get refreshInterval(): number {
        return 100;
    }

    public async refreshData(
        device: VirtualDevice<RandomGeneratorVirtualDeviceLogic>
    ): Promise<void> {
        const newNumber = Math.floor(Math.random() * (this.config.max - this.config.min + 1)) + this.config.min;
        await device.setAttribute('value', Int.from(newNumber));
    }

    public configureAttributes(): RandomGeneratorVirtualDeviceAttributes {
        const valueAttr = IntDeviceAttribute.create(
            'value', 'Random number', DeviceAttributeModifier.readOnly, undefined
        );

        return {
            value: valueAttr
        };
    }
}
