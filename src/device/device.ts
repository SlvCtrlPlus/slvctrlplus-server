import {Exclude, Expose} from "class-transformer";
import DeviceInput from "./deviceInput.js";
import DeviceOutput from "./deviceOutput.js";

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

    protected constructor(
        deviceId: string,
        deviceName: string,
        connectedSince: Date,
        controllable: boolean
    ) {
        this.deviceId = deviceId;
        this.deviceName = deviceName;
        this.connectedSince = connectedSince;
        this.controllable = controllable;
        this.state = DeviceState.ready;
    }

    protected logDeviceError(device: Device, e: Error): void {
        let str = `Error for device '${device.getDeviceId}': ${e.message}`;
        let currentCause = e.cause as Error;

        while (currentCause) {
            str += ` -> ${currentCause.message}`;
            currentCause = currentCause.cause as Error;
        }

        console.log(str)
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
        return 250;
    }

    public get getState(): DeviceState {
        return this.state;
    }

    public static getInputs(): {[key: string]: DeviceInput<Device, any>} {
        return {};
    }

    public static getOutputs(): {[key: string]: DeviceOutput<Device, any>} {
        return {};
    }
}
