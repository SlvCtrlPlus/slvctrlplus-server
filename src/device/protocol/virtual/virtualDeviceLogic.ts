import VirtualDevice from './virtualDevice.js';
import { DeviceAttributes } from '../../device.js';
import { AnyDeviceConfig, NoDeviceConfig } from '../../deviceConfig.js';

export type ExtractAttributes<TLogic extends VirtualDeviceLogic<DeviceAttributes, AnyDeviceConfig>> =
    TLogic extends VirtualDeviceLogic<infer TAttributes extends DeviceAttributes, any>
        ? TAttributes
        : never;

export type ExtractConfig<TLogic extends VirtualDeviceLogic<DeviceAttributes, AnyDeviceConfig>> =
    TLogic extends VirtualDeviceLogic<any, infer TConfig extends AnyDeviceConfig>
        ? TConfig
        : never;

export default abstract class VirtualDeviceLogic<
    TAttributes extends DeviceAttributes = DeviceAttributes,
    TConfig extends AnyDeviceConfig = NoDeviceConfig
> {
    protected config: TConfig;

    protected constructor(config: TConfig) {
        this.config = config;
    }

    public abstract refreshData(device: VirtualDevice<this>): Promise<void>;

    public abstract configureAttributes(): TAttributes;

    public abstract get refreshInterval(): number;
}
