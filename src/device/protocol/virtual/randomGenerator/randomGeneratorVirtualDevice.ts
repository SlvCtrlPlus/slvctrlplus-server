import {Exclude} from "class-transformer";
import VirtualDevice from "../virtualDevice.js";
import GenericDeviceAttribute, {GenericDeviceAttributeModifier} from "../../../attribute/genericDeviceAttribute.js";
import IntGenericDeviceAttribute from "../../../attribute/intGenericDeviceAttribute.js";

@Exclude()
export default class RandomGeneratorVirtualDevice extends VirtualDevice {

    private readonly min: number;

    private readonly max: number;

    public constructor(fwVersion: string, deviceId: string, deviceName: string, deviceModel: string, provider: string, connectedSince: Date, config: JsonObject) {
        super(fwVersion, deviceId, deviceName, deviceModel, provider, connectedSince, config, RandomGeneratorVirtualDevice.configureAttributes());

        this.min = config.min as number;
        this.max = config.max as number;
    }

    public refreshData(): Promise<void> {
        return new Promise<void>((resolve) => {
            void this.setAttribute('value', Math.floor(Math.random() * (this.max - this.min + 1)) + this.min);
            resolve();
        });
    }

    protected static configureAttributes(): GenericDeviceAttribute[] {
        const valueAttr = new IntGenericDeviceAttribute();
        valueAttr.name = 'value';
        valueAttr.modifier = GenericDeviceAttributeModifier.readOnly;

        return [valueAttr];
    }
}
