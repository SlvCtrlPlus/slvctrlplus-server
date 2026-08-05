import { Exclude, Expose } from 'class-transformer';
import DeviceState from './deviceState.js';
import DeviceAttribute, { AttributeValue } from './attribute/deviceAttribute.js';
import { AnyDeviceConfig, NoDeviceConfig } from './deviceConfig.js';
import { EventEmitter } from 'events';
import type { DeviceId } from './deviceId.js';
import type { JsonObject } from '../types.js';
import { DropFirst } from '../types.js';
import Logger from '../logging/Logger.js';

// An attribute value can be DeviceAttribute or undefined because we want to allow Partial<>
export type DeviceAttributes = Record<string, DeviceAttribute | undefined>;

export type DeviceNotifications = JsonObject;
export type NoDeviceNotifications = Record<never, never>;
type AnyDeviceNotifications = JsonObject;

export type AttributeKeyOf<A extends DeviceAttributes> = keyof A & string;
export type AttributeValueOf<A extends DeviceAttributes, K extends AttributeKeyOf<A>> =
    NonNullable<A[K]>['value'];

export type DeviceAttributeOf<T extends DeviceAttributes> = {
    [K in AttributeKeyOf<T>]: T[K] & { name: K }
}[AttributeKeyOf<T>];

export type DeviceData<T extends DeviceAttributes = DeviceAttributes> = {
    [K in AttributeKeyOf<T>]: AttributeValueOf<T, K>;
};

export type DeviceError = {
    reason: string;
    occurredAt: Date;
};

export enum DeviceEvent {
    deviceDisconnected = 'deviceDisconnected',
    deviceRefreshed = 'deviceRefreshed',
    deviceNotification = 'deviceNotification',
}

type DeviceNotification<TNotifications extends DeviceNotifications> =
    { [K in keyof TNotifications & string]: { type: K, data: TNotifications[K] } }[keyof TNotifications & string];

export type AnyDeviceNotification = DeviceNotification<AnyDeviceNotifications>;

export type DeviceEventMap<
    TDevice extends AnyDevice,
    TNotifications extends DeviceNotifications,
> = {
    [DeviceEvent.deviceRefreshed]: [device: TDevice];
    [DeviceEvent.deviceDisconnected]: [device: TDevice];
    [DeviceEvent.deviceNotification]: [device: TDevice, notification: DeviceNotification<TNotifications>];
};

export type WithUntypedAttributes<D extends AnyDevice> = Omit<D, 'setAttribute'> & {
    setAttribute(attributeName: string, value: AttributeValue): Promise<AttributeValue>;
};

export type AnyDevice = WithUntypedAttributes<Device>;

@Exclude()
export default abstract class Device<
    TAttributes extends DeviceAttributes = DeviceAttributes,
    TNotifications extends DeviceNotifications = NoDeviceNotifications,
    TConfig extends AnyDeviceConfig = NoDeviceConfig,
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

    private closePromise?: Promise<void>;

    protected readonly logger: Logger;

    protected constructor(
        deviceId: DeviceId,
        deviceName: string,
        provider: string,
        connectedSince: Date,
        controllable: boolean,
        attributes: TAttributes,
        config: TConfig,
        eventEmitter: EventEmitter,
        logger: Logger,
    ) {
        this.deviceId = deviceId;
        this.deviceName = deviceName;
        this.provider = provider;
        this.connectedSince = connectedSince;
        this.controllable = controllable;
        this.attributes = attributes;
        this.config = config;
        this.eventEmitter = eventEmitter;
        this.logger = logger.child({ name: `${new.target.name}.${deviceId}` });
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
        if (this.state === DeviceState.closed || this.state === DeviceState.closing) {
            throw new Error('Cannot refresh device as it is closed or closing');
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
    public getAttribute<K extends AttributeKeyOf<TAttributes>>(key: K): Promise<TAttributes[K] | undefined> {
        return Promise.resolve(this.attributes[key]);
    }

    public abstract setAttribute<K extends AttributeKeyOf<TAttributes>>(
        attributeName: K,
        value: AttributeValueOf<TAttributes, K>
    ): Promise<AttributeValueOf<TAttributes, K>>;

    public on<K extends DeviceEvent>(event: K, listener: (...args: DeviceEventMap<this, TNotifications>[K]) => void): void
    {
        this.eventEmitter.on(event, listener);
    }

    public async close(): Promise<void>
    {
        if (undefined !== this.closePromise) {
            return this.closePromise;
        }

        this.state = DeviceState.closing;
        this.closePromise = this.performClose();

        return this.closePromise;
    }

    private async performClose(): Promise<void>
    {
        try {
            await this.doClose();
        } finally {
            this.state = DeviceState.closed;
            this.emit(DeviceEvent.deviceDisconnected);
        }
    }

    protected async doClose(): Promise<void>
    {
        // no-op
    }

    protected updateLastRefresh(): void
    {
        this.lastRefresh = new Date();
        this.emit(DeviceEvent.deviceRefreshed);
    }

    protected emit<K extends DeviceEvent>(eventName: K, ...args: DropFirst<DeviceEventMap<this, TNotifications>[K]>): boolean
    {
        return this.eventEmitter.emit(eventName, this, ...args);
    }

    protected isAttributePresent(
        attr: TAttributes[keyof TAttributes],
    ): attr is DeviceAttributeOf<TAttributes> {
        return attr !== null && typeof attr === 'object' && 'name' in attr && Object.keys(this.attributes).includes(attr.name);
    }
}
