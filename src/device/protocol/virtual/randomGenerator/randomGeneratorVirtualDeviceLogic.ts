import GenericDeviceAttribute, {GenericDeviceAttributeModifier} from "../../../attribute/genericDeviceAttribute.js";
import IntGenericDeviceAttribute from "../../../attribute/intGenericDeviceAttribute.js";
import VirtualDeviceLogic from "../virtualDeviceLogic.js";
import VirtualDevice from "../virtualDevice.js";

export default class RandomGeneratorVirtualDeviceLogic implements VirtualDeviceLogic {

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

    public refreshData(device: VirtualDevice): Promise<void> {
        return new Promise<void>((resolve) => {
            const newNumber = Math.floor(Math.random() * (this.max - this.min + 1)) + this.min;
            void device.setAttribute('value', newNumber);
            resolve();
        });
    }

    public configureAttributes(): GenericDeviceAttribute[] {
        const valueAttr = new IntGenericDeviceAttribute();
        valueAttr.name = 'value';
        valueAttr.modifier = GenericDeviceAttributeModifier.readOnly;

        return [valueAttr];
    }
}
