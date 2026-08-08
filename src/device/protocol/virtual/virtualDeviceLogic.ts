import type VirtualDevice from './virtualDevice.js';
import type { DeviceAttributes } from '../../device.js';
import type { AnyDeviceConfig, NoDeviceConfig } from '../../deviceConfig.js';

export type ExtractAttributes<TLogic extends VirtualDeviceLogic<DeviceAttributes, AnyDeviceConfig>> =
    TLogic extends VirtualDeviceLogic<infer TAttributes extends DeviceAttributes, AnyDeviceConfig>
        ? TAttributes
        : never;

export type ExtractConfig<TLogic extends VirtualDeviceLogic<DeviceAttributes, AnyDeviceConfig>> =
    TLogic extends VirtualDeviceLogic<DeviceAttributes, infer TConfig extends AnyDeviceConfig>
        ? TConfig
        : never;

export type AnyVirtualDeviceLogic = VirtualDeviceLogic<DeviceAttributes, AnyDeviceConfig>;

export default abstract class VirtualDeviceLogic<
    TAttributes extends DeviceAttributes = DeviceAttributes,
    TConfig extends AnyDeviceConfig = NoDeviceConfig,
> {
    protected config: TConfig;

    protected constructor(config: TConfig) {
        this.config = config;
    }

    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    public async destroy(): Promise<void> {
        // no-op
    }

    public abstract refreshData(device: VirtualDevice<this>): Promise<void>;

    public abstract configureAttributes(): TAttributes;

    public abstract get refreshInterval(): number;
}
