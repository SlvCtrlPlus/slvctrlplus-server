import {GenericDeviceAttributeModifier} from "../../../attribute/genericDeviceAttribute.js";
import IntGenericDeviceAttribute from "../../../attribute/intGenericDeviceAttribute.js";
import VirtualDeviceLogic from "../virtualDeviceLogic.js";
import VirtualDevice from "../virtualDevice.js";

type RandomGeneratorVirtualDeviceAttributes = {
    value: IntGenericDeviceAttribute;
}

export default class RandomGeneratorVirtualDeviceLogic implements VirtualDeviceLogic<RandomGeneratorVirtualDeviceAttributes> {

    private readonly min: number;

    private readonly max: number;

    public constructor(config: JsonObject) {
        if (!config.hasOwnProperty('min')) {
            throw new Error(`Config value 'min' missing`);
        }
        if (!config.hasOwnProperty('max')) {
            throw new Error(`Config value 'max' missing`);
        }
        this.min = config.min as number;
        this.max = config.max as number;
    }

    public get getRefreshInterval(): number {
        return 100;
    }

    public async refreshData(device: VirtualDevice<RandomGeneratorVirtualDeviceAttributes>): Promise<void> {
        const newNumber = Math.floor(Math.random() * (this.max - this.min + 1)) + this.min;
        await device.setAttribute('value', newNumber);
    }

    public configureAttributes(): RandomGeneratorVirtualDeviceAttributes {
        const valueAttr = new IntGenericDeviceAttribute();
        valueAttr.name = 'value';
        valueAttr.modifier = GenericDeviceAttributeModifier.readOnly;

        return {
            value: valueAttr
        };
    }
}
