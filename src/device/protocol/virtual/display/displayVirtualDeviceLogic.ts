import { DeviceAttributeModifier } from '../../../attribute/deviceAttribute.js';
import StrDeviceAttribute from '../../../attribute/strDeviceAttribute.js';
import VirtualDeviceLogic from '../virtualDeviceLogic.js';
import { NoDeviceConfig } from '../../../deviceConfig.js';

type DisplayVirtualDeviceAttributes = {
    content: StrDeviceAttribute;
}

export default class DisplayVirtualDeviceLogic extends VirtualDeviceLogic<DisplayVirtualDeviceAttributes> {
    public constructor(config: NoDeviceConfig) {
        super(config);
    }

    public async refreshData(): Promise<void> {
        // no-op, because it doesn't read anything from anywhere
        return Promise.resolve();
    }

    public get refreshInterval(): number {
        return 175;
    }

    public configureAttributes(): DisplayVirtualDeviceAttributes {
        const contentAttr = StrDeviceAttribute.create(
            'content', 'Content', DeviceAttributeModifier.readWrite
        );

        return {
            content: contentAttr
        };
    }
}
