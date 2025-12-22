import {GenericDeviceAttributeModifier} from "../../../attribute/genericDeviceAttribute.js";
import StrGenericDeviceAttribute from "../../../attribute/strGenericDeviceAttribute.js";
import VirtualDeviceLogic from "../virtualDeviceLogic.js";

type DisplayVirtualDeviceAttributes = {
    content: StrGenericDeviceAttribute;
}

export default class DisplayVirtualDeviceLogic implements VirtualDeviceLogic<DisplayVirtualDeviceAttributes> {

    public async refreshData(): Promise<void> {
        // no-op, because it doesn't read anything from anywhere
        return Promise.resolve();
    }

    public get getRefreshInterval(): number {
        return 175;
    }

    public configureAttributes(): DisplayVirtualDeviceAttributes {
        const contentAttr = new StrGenericDeviceAttribute();
        contentAttr.name = 'content';
        contentAttr.modifier = GenericDeviceAttributeModifier.readWrite;

        return {
            content: contentAttr
        };
    }
}
