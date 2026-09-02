import { DeviceAttributeModifier } from '../../../attribute/deviceAttribute.js';
import StrDeviceAttribute from '../../../attribute/strDeviceAttribute.js';
import VirtualDeviceLogic from '../virtualDeviceLogic.js';
import type { NoDeviceConfig } from '../../../deviceConfig.js';

type DisplayVirtualDeviceAttributes = {
    content: StrDeviceAttribute;
};

export default class DisplayVirtualDeviceLogic extends VirtualDeviceLogic<DisplayVirtualDeviceAttributes> {
    private static readonly REFRESH_INTERVAL_MS = 175;

    public constructor(config: NoDeviceConfig) {
        super(config);
    }

    public override async refreshData(): Promise<void> {
        // no-op, because it doesn't read anything from anywhere
        return Promise.resolve();
    }

    public override get refreshInterval(): number {
        return DisplayVirtualDeviceLogic.REFRESH_INTERVAL_MS;
    }

    public override configureAttributes(): DisplayVirtualDeviceAttributes {
        const contentAttr = StrDeviceAttribute.create({
            name: 'content', label: 'Content', modifier: DeviceAttributeModifier.readWrite, initialValue: '',
        });

        return {
            content: contentAttr,
        };
    }
}
