import Device, { ExtractAttributeValue } from '../../device.js';
import IntRangeDeviceAttribute from '../../attribute/intRangeDeviceAttribute.js';
import EStim2bProtocol, { EStim2bStatus } from './estim2bProtocol.js';
import { Exclude } from 'class-transformer';
import { Int } from '../../../util/numbers.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';

export type EStim2bDeviceAttributes = {
    channelALevel: IntRangeDeviceAttribute,
    channelBLevel: IntRangeDeviceAttribute,
    pulseFrequency: IntRangeDeviceAttribute,
    pulsePwm: IntRangeDeviceAttribute,
    highPowerMode: BoolDeviceAttribute,
}

@Exclude()
export default class EStim2bDevice extends Device<EStim2bDeviceAttributes> {
    private readonly protocol: EStim2bProtocol;

    public constructor(
        deviceId: string,
        deviceName: string,
        provider: string,
        connectedSince: Date,
        controllable: boolean,
        protocol: EStim2bProtocol,
        attributes: EStim2bDeviceAttributes
    ) {
        super(deviceId, deviceName, provider, connectedSince, controllable, attributes, { });

        this.protocol = protocol;

        protocol.on('statusUpdated', status => this.updateAttributes(status));
    }

    protected updateAttributes(status: EStim2bStatus): void {
        this.attributes.channelALevel.value = Int.from(Math.round(status.channelALevel));
        this.attributes.channelBLevel.value = Int.from(Math.round(status.channelBLevel));
        this.attributes.pulseFrequency.value = Int.from(Math.round(status.pulseFrequency));
        this.attributes.pulsePwm.value = Int.from(Math.round(status.pulsePwm));
        this.attributes.highPowerMode.value = status.powerMode === 'H';
    }

    public refreshData(): Promise<void> {
        return new Promise((resolve) => {
            this.protocol.requestStatus();
            resolve();
        });
    }

    public async setAttribute<
        K extends keyof EStim2bDeviceAttributes,
        V extends ExtractAttributeValue<EStim2bDeviceAttributes[K]>
    >(attributeName: K, value: V): Promise<V> {
        return Promise.resolve(value);
    }
}
