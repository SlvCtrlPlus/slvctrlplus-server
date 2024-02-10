import {Exclude, Expose} from "class-transformer";
import DeviceState from "./deviceState.js";
import DeviceProviderEvent from "./provider/deviceProviderEvent.js";
import EventEmitter from "events";
import DeviceEvent from "./deviceEvent.js";

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

    private readonly eventEmitter: EventEmitter;

    private refreshTimer: NodeJS.Timeout;

    protected constructor(
        deviceId: string,
        deviceName: string,
        provider: string,
        connectedSince: Date,
        controllable: boolean,
        eventEmitter: EventEmitter
    ) {
        this.deviceId = deviceId;
        this.deviceName = deviceName;
        this.provider = provider;
        this.connectedSince = connectedSince;
        this.controllable = controllable;
        this.eventEmitter = eventEmitter;
        this.state = DeviceState.ready;
    }

    public abstract refreshData(): Promise<void>;

    public start(): void
    {
        const deviceStatusUpdater = () => {
            if (this.getState === DeviceState.busy) {
                return;
            }

            this.refreshData().then(() => this.updateLastRefresh()).catch(
                (e: Error) => this.eventEmitter.emit(DeviceEvent.deviceError, this, e)
            );

            this.eventEmitter.emit(DeviceEvent.deviceRefreshed, this);
        };

        this.refreshTimer = setInterval(deviceStatusUpdater, this.getRefreshInterval);

        setTimeout(deviceStatusUpdater, 0); // Immediately execute async
    }

    public stop(): void
    {
        if (undefined !== this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = undefined;
        }
    }

    protected updateLastRefresh(): void
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

    public on(event: DeviceEvent, listener: ((device: Device) => void)|((device: Device, e: Error) => void)): this
    {
        this.eventEmitter.on(event, listener);

        return this;
    }
}
