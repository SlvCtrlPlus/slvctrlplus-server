import {Exclude, Expose, Type} from "class-transformer";
import DeviceState from "./deviceState.js";
import GenericDeviceAttribute from "./attribute/genericDeviceAttribute.js";
import GenericDeviceAttributeDiscriminator from "../serialization/discriminator/genericDeviceAttributeDiscriminator.js";

@Exclude()
export default abstract class Device
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
    protected data: JsonObject = {};

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

    public getAttributeDefinition(name: string): GenericDeviceAttribute|null
    {
        for (const attr of this.attributes) {
            if (attr.name === name) {
                return attr;
            }
        }

        return null;
    }

    public abstract getAttribute(key: string): Promise<string|number|boolean|null>;

    public abstract setAttribute(attributeName: string, value: string|number|boolean|null): Promise<string>;
}
