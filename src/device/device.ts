import {Exclude, Expose, Type} from "class-transformer";
import DeviceState from "./deviceState.js";
import GenericDeviceAttribute from "./attribute/genericDeviceAttribute.js";
import GenericDeviceAttributeDiscriminator from "../serialization/discriminator/genericDeviceAttributeDiscriminator.js";

export type AttributeValue = string | number | boolean | null;
export type DeviceData = Record<string, AttributeValue>;

@Exclude()
export default abstract class Device<T extends DeviceData = DeviceData>
{
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
    protected readonly type: string; // This field is only here to expose it explicitly

    @Expose()
    protected readonly controllable: boolean;

    @Expose()
    protected lastRefresh: Date;

    @Expose()
    @Type(() => GenericDeviceAttribute, GenericDeviceAttributeDiscriminator.createClassTransformerTypeDiscriminator('type'))
    protected readonly attributes: GenericDeviceAttribute[];

    @Expose()
    protected data: T = {} as T;

    protected constructor(
        deviceId: string,
        deviceName: string,
        provider: string,
        connectedSince: Date,
        controllable: boolean,
        attributes: GenericDeviceAttribute[]
    ) {
        this.deviceId = deviceId;
        this.deviceName = deviceName;
        this.provider = provider;
        this.connectedSince = connectedSince;
        this.controllable = controllable;
        this.attributes = attributes;
        this.state = DeviceState.ready;
    }

    public abstract refreshData(): Promise<void>;

    public updateLastRefresh(): void
    {
        this.lastRefresh = new Date();
    }

    public get getDeviceId(): string
    {
        return this.deviceId;
    }

    public get getDeviceName(): string
    {
        return this.deviceName;
    }

    public get getProvider(): string
    {
        return this.provider;
    }

    public get isControllable(): boolean
    {
        return this.controllable;
    }

    public get getRefreshInterval(): number {
        return 250;
    }

    public get getState(): DeviceState {
        return this.state;
    }

    public getAttributeDefinitions(): GenericDeviceAttribute[]
    {
        return this.attributes;
    }

    public getAttributeDefinition<K extends keyof T>(name: K): GenericDeviceAttribute|null
    {
        for (const attr of this.attributes) {
            if (attr.name === name) {
                return attr;
            }
        }

        return null;
    }

    public getAttribute<K extends keyof T>(key: K): Promise<T[K]>
    {
        return new Promise<T[K]>(() => this.data[key]);
    }

    public abstract setAttribute<K extends keyof T>(attributeName: K, value: T[K]): Promise<T[K]>;
}
