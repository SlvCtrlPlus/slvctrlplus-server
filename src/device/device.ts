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
    protected state: DeviceState;

    @Expose()
    protected readonly type: string; // This field is only here to expose it explicitly

    @Expose()
    protected readonly controllable: boolean;

    @Expose()
    protected lastRefresh: Date;

    protected refreshInterval: number
    private intervalTimer: number;

    protected constructor(
        deviceId: string,
        deviceName: string,
        connectedSince: Date,
        controllable: boolean,
        refreshInterval: number = 250
    ) {
        this.deviceId = deviceId;
        this.deviceName = deviceName;
        this.connectedSince = connectedSince;
        this.controllable = controllable;
        this.state = DeviceState.ready;
        this.refreshInterval = refreshInterval;
    }

    public abstract refreshData(): void;

    public updateLastRefresh(): void
    {
        this.lastRefresh = new Date();
    }

    public get getDeviceId(): string
    {
        return this.deviceId;
    }

    public get isControllable(): boolean
    {
        return this.controllable;
    }

    public get getRefreshInterval(): number {
        return this.refreshInterval;
    }

    public get getState(): DeviceState {
        return this.state;
    }

    public setUpdater(cb: Function): void {
        cb();
        this.intervalTimer = setInterval(cb, this.refreshInterval);
    }

    public clearUpdater(): void {
        clearInterval(this.intervalTimer);
    }
}
