import {Exclude} from "class-transformer";
import VirtualDevice from "../virtualDevice.js";
import GenericDeviceAttribute, {GenericDeviceAttributeModifier} from "../../../attribute/genericDeviceAttribute.js";
import StrGenericDeviceAttribute from "../../../attribute/strGenericDeviceAttribute.js";

@Exclude()
export default class DisplayVirtualDevice extends VirtualDevice {

    public constructor(fwVersion: string, deviceId: string, deviceName: string, deviceModel: string, provider: string, connectedSince: Date, config: JsonObject) {
        super(fwVersion, deviceId, deviceName, deviceModel, provider, connectedSince, config, DisplayVirtualDevice.configureAttributes());
    }

    protected static configureAttributes(): GenericDeviceAttribute[] {
        const contentAttr = new StrGenericDeviceAttribute();
        contentAttr.name = 'content';
        contentAttr.modifier = GenericDeviceAttributeModifier.readWrite;

        return [contentAttr];
    }
}
