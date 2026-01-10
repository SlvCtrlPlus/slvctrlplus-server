import {DeviceAttributeModifier} from "../../../attribute/deviceAttribute.js";
import IntDeviceAttribute from "../../../attribute/intDeviceAttribute.js";
import VirtualDeviceLogic from "../virtualDeviceLogic.js";
import VirtualDevice from "../virtualDevice.js";
import {Int} from "../../../../util/numbers.js";
import {RandomGeneratorVirtualDeviceConfig} from "./randomGeneratorVirtualDeviceConfig.js";

type RandomGeneratorVirtualDeviceAttributes = {
    value: IntDeviceAttribute;
}

export default class RandomGeneratorVirtualDeviceLogic implements VirtualDeviceLogic<
    RandomGeneratorVirtualDeviceAttributes,
    RandomGeneratorVirtualDeviceConfig
> {
    private readonly min: number;

    private readonly max: number;

    public constructor(config: RandomGeneratorVirtualDeviceConfig) {
        this.min = config.min;
        this.max = config.max;
    }

    public get refreshInterval(): number {
        return 100;
    }

    public async refreshData(device: VirtualDevice<RandomGeneratorVirtualDeviceAttributes, RandomGeneratorVirtualDeviceConfig>): Promise<void> {
        const newNumber = Math.floor(Math.random() * (this.max - this.min + 1)) + this.min;
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
