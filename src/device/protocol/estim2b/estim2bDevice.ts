import Device, { ExtractAttributeValue } from '../../device.js';
import IntRangeDeviceAttribute from '../../attribute/intRangeDeviceAttribute.js';

export type EStim2bDeviceAttributes = {
    channelAPower: IntRangeDeviceAttribute,
    channelBPower: IntRangeDeviceAttribute,
}

export default class EStim2bDevice extends Device<EStim2bDeviceAttributes> {
    public refreshData(): Promise<void> {
        return Promise.resolve(undefined);
    }

    public async setAttribute<
        K extends keyof EStim2bDeviceAttributes,
        V extends ExtractAttributeValue<EStim2bDeviceAttributes[K]>
    >(attributeName: K, value: V): Promise<V> {
        return Promise.resolve(value);
    }
}
