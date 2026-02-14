import { Exclude } from 'class-transformer';
import Device from '../../device.js';
import DeviceAttribute from '../../attribute/deviceAttribute.js';
import { AnyDeviceConfig, NoDeviceConfig } from '../../deviceConfig.js';
import SlvCtrlProtocol from './slvCtrlProtocol.js';

export type SlvCtrlPlusDeviceAttributeKey = string;
export type SlvCtrlPlusDeviceAttributes = Record<SlvCtrlPlusDeviceAttributeKey, DeviceAttribute>;

@Exclude()
export default abstract class SlvCtrlPlusDevice<
    TAttributes extends SlvCtrlPlusDeviceAttributes = SlvCtrlPlusDeviceAttributes,
    TConfig extends AnyDeviceConfig = NoDeviceConfig,
> extends Device<TAttributes, TConfig> {
    protected readonly protocol;

    protected constructor(
        deviceId: string,
        deviceName: string,
        provider: string,
        connectedSince: Date,
        protocol: SlvCtrlProtocol,
        controllable: boolean,
        attributes: TAttributes,
        config: TConfig
    ) {
        super(deviceId, deviceName, provider, connectedSince, controllable, attributes, config);
        this.protocol = protocol;
    }

    protected getSerialTimeout(): number {
        return 0;
    }
}
