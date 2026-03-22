import { Exclude, Expose } from 'class-transformer';
import DeviceState from './deviceState.js';
import DeviceAttribute from './attribute/deviceAttribute.js';
import { AnyDeviceConfig, NoDeviceConfig } from './deviceConfig.js';
import { EventEmitter } from 'events';
import type { DeviceId } from './deviceId.js';

export type InferDeviceAttributes<D extends Device<DeviceAttributes, AnyDeviceConfig>> =
    D extends Device<infer TAttrs, any> ? TAttrs : DeviceAttributes;

export type InferDeviceConfig<D extends Device<DeviceAttributes, AnyDeviceConfig>> =
    D extends Device<any, infer TCfg> ? TCfg : AnyDeviceConfig;

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

export enum DeviceEvent {
    deviceDisconnected = 'deviceDisconnected',
    deviceRefreshed = 'deviceRefreshed',
}

export type DeviceEventMap<TDevice = Device<any, any>> = {
    [DeviceEvent.deviceRefreshed]: [device: TDevice];
    [DeviceEvent.deviceDisconnected]: [device: TDevice];
}

@Exclude()
export default abstract class Device<
    TAttributes extends DeviceAttributes = DeviceAttributes,
    TConfig extends AnyDeviceConfig = NoDeviceConfig
> {
    @Expose()
    protected readonly deviceId: DeviceId;

    @Expose()
    protected readonly connectedSince: Date;

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
    protected attributes: TAttributes;

    @Expose()
    protected readonly config: TConfig;

    private eventEmitter: EventEmitter;

    protected constructor(
        deviceId: DeviceId,
        deviceName: string,
        provider: string,
        connectedSince: Date,
        controllable: boolean,
        attributes: TAttributes,
        config: TConfig,
        eventEmitter: EventEmitter
    ) {
        this.deviceId = deviceId;
        this.deviceName = deviceName;
        this.provider = provider;
        this.connectedSince = connectedSince;
        this.controllable = controllable;
        this.attributes = attributes;
        this.config = config;
        this.eventEmitter = eventEmitter;
        this.state = DeviceState.ready;
    }

    public get getDeviceId(): DeviceId {
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

    public get getRefreshInterval(): number | undefined {
        return undefined;
    }

    public get getState(): DeviceState {
        return this.state;
    }

    public async refresh(): Promise<void>
    {
        if (this.state === DeviceState.closed) {
            throw new Error('Cannot refresh device as it is closed');
        }

        await this.doRefresh();

        this.updateLastRefresh();
    }

    protected async doRefresh(): Promise<void> {
        // no-op
    }

    /**
     * Get attribute by key
     * @param key The attribute key
     * @returns attribute value or undefined if attribute is not found. And attribute potentially cannot be found
     * if the generic attribute type of this class happens to be a/wrapped in a Partial
     */
    public getAttribute<K extends keyof TAttributes & string>(key: K): Promise<TAttributes[K] | undefined> {
        return Promise.resolve(this.attributes[key]);
    }

    public abstract setAttribute<
        K extends keyof TAttributes & string,
        V extends ExtractAttributeValue<TAttributes[K]>
    >(attributeName: K, value: V): Promise<V>;

    public on<K extends DeviceEvent>(event: K, listener: (...args: DeviceEventMap<this>[K]) => void): void
    {
        this.eventEmitter.on(event, listener);
    }

    public async close(): Promise<void>
    {
        if (this.state === DeviceState.closed) {
            return
        }

        try {
            await this.doClose();
        } finally {
            this.state = DeviceState.closed;
            this.emit(DeviceEvent.deviceDisconnected, this);
        }
    }

    protected async doClose(): Promise<void>
    {
        // no-op
    }

    protected updateLastRefresh(): void
    {
        this.lastRefresh = new Date();
        this.emit(DeviceEvent.deviceRefreshed, this);
    }

    protected emit<K extends DeviceEvent>(eventName: K, ...args: DeviceEventMap<this>[K]): boolean
    {
        return this.eventEmitter.emit(eventName, ...args);
    }
}
