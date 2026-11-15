import type VirtualDevice from './virtualDevice.js';
import type { DeviceAttributeValues } from '../../device.js';
import type { AnyDeviceConfig, NoDeviceConfig } from '../../deviceConfig.js';
import type { TSchema } from '@sinclair/typebox';

export type VirtualDeviceSetup<TDeviceData extends DeviceAttributeValues> = {
    schema: TSchema;
    data: TDeviceData;
};

export type ExtractDeviceData<TLogic extends VirtualDeviceLogic<DeviceAttributeValues, AnyDeviceConfig>> =
    TLogic extends VirtualDeviceLogic<infer TDeviceData extends DeviceAttributeValues, AnyDeviceConfig>
        ? TDeviceData
        : never;

export type ExtractConfig<TLogic extends VirtualDeviceLogic<DeviceAttributeValues, AnyDeviceConfig>> =
    TLogic extends VirtualDeviceLogic<DeviceAttributeValues, infer TConfig extends AnyDeviceConfig>
        ? TConfig
        : never;

export type AnyVirtualDeviceLogic = VirtualDeviceLogic<DeviceAttributeValues, AnyDeviceConfig>;

export default abstract class VirtualDeviceLogic<
    TDeviceData extends DeviceAttributeValues = DeviceAttributeValues,
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

    public abstract configureDevice(): VirtualDeviceSetup<TDeviceData>;

    public abstract get refreshInterval(): number;
}
