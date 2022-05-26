import SynchronousSerialPort from "../serial/SynchronousSerialPort.js";
import {PortInfo} from "@serialport/bindings-interface/dist/index.js";
import {Exclude, Expose} from "class-transformer";

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
        this.type = DeviceState.ready;
    }

    public abstract refreshData(): void;

    public get getDeviceId(): string
    {
        return this.deviceId;
    }

    public get isControllable(): boolean
    {
        return this.controllable;
    }
}
