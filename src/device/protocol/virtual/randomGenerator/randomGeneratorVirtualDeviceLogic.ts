import {DeviceAttributeModifier} from "../../../attribute/deviceAttribute.js";
import IntDeviceAttribute from "../../../attribute/intDeviceAttribute.js";
import VirtualDeviceLogic from "../virtualDeviceLogic.js";
import VirtualDevice from "../virtualDevice.js";
import {Int} from "../../../../util/numbers.js";
import {JsonObject} from "../../../../types.js";

type RandomGeneratorVirtualDeviceAttributes = {
    value: IntDeviceAttribute;
}

export default class RandomGeneratorVirtualDeviceLogic implements VirtualDeviceLogic<RandomGeneratorVirtualDeviceAttributes> {

    private readonly min: number;

    private readonly max: number;

    public constructor(config: JsonObject) {
        if (!Object.hasOwn(config, 'min')) {
            throw new Error(`Config value 'min' missing`);
        }
        if (!Object.hasOwn(config, 'max')) {
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
