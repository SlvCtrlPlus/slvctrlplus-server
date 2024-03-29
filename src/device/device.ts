import {Exclude, Expose} from "class-transformer";
import DeviceState from "./deviceState.js";

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

    protected constructor(
        deviceId: string,
        deviceName: string,
        provider: string,
        connectedSince: Date,
        controllable: boolean
    ) {
        this.deviceId = deviceId;
        this.deviceName = deviceName;
        this.provider = provider;
        this.connectedSince = connectedSince;
        this.controllable = controllable;
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
}
