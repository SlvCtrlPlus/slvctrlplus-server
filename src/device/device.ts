import { Exclude, Expose } from 'class-transformer';
import DeviceState from './deviceState.js';
import DeviceAttribute from './attribute/deviceAttribute.js';
import { AnyDeviceConfig, NoDeviceConfig } from './deviceConfig.js';

// An attribute value can be DeviceAttribute or undefined because we want to allow Partial<>
export type DeviceAttributes = Record<string, DeviceAttribute | undefined>;

export type ExtractAttributeValue<A> = A extends DeviceAttribute<infer V> ? V : never;
type AttributeKey<T> = T extends { value: any } ? T : never;

export type DeviceData<T extends DeviceAttributes = DeviceAttributes> = {
    [K in keyof T as AttributeKey<T[K]> extends never ? never : K]:
    ExtractAttributeValue<T[K]>;
};

export type DeviceError = {
    reason: string;
    occurredAt: Date;
}

@Exclude()
export default abstract class Device<
    TAttributes extends DeviceAttributes = DeviceAttributes,
    TConfig extends AnyDeviceConfig = NoDeviceConfig
> {
    @Expose()
    protected readonly connectedSince: Date;

    @Expose()
    protected readonly deviceId: string;

    @Expose()
    protected readonly deviceName: string;

    @Expose()
    protected readonly provider: string;

    @Expose()
    protected state: DeviceState;

    @Expose()
    protected errorInfo: DeviceError | undefined;

    @Expose()
    protected readonly type: string | undefined; // This field is only here to expose it explicitly

    @Expose()
    protected readonly controllable: boolean;

    @Expose()
    protected lastRefresh: Date | undefined;

    @Expose()
    protected readonly attributes: TAttributes;

    @Expose()
    protected readonly config: TConfig;

    protected constructor(
        deviceId: string,
        deviceName: string,
        provider: string,
        connectedSince: Date,
        controllable: boolean,
        attributes: TAttributes,
        config: TConfig,
    ) {
        this.deviceId = deviceId;
        this.deviceName = deviceName;
        this.provider = provider;
        this.connectedSince = connectedSince;
        this.controllable = controllable;
        this.attributes = attributes;
        this.config = config;
        this.state = DeviceState.ready;
    }

    public abstract refreshData(): Promise<void>;

    public updateLastRefresh(): void {
        this.lastRefresh = new Date();
    }

    public get getDeviceId(): string {
        return this.deviceId;
    }

    public get getDeviceName(): string {
        return this.deviceName;
    }

    public get getProvider(): string {
        return this.provider;
    }

    public get isControllable(): boolean {
        return this.controllable;
    }

    public get getRefreshInterval(): number {
        return 250;
    }

    public get getState(): DeviceState {
        return this.state;
    }

    /**
     * Get attribute by key
     * @param key The attribute key
     * @returns attribute value or undefined if attribute is not found. And attribute potentially cannot be found
     * if the generic attribute type of this class happens to be a/wrapped in a Partial
     */
    public getAttribute<K extends keyof TAttributes>(key: K): Promise<TAttributes[K] | undefined> {
        return Promise.resolve(this.attributes[key]);
    }

    public abstract setAttribute<K extends keyof TAttributes, V extends ExtractAttributeValue<TAttributes[K]>>(attributeName: K, value: V): Promise<V>;
}
