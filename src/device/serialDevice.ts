import SynchronousSerialPort from "../serial/SynchronousSerialPort.js";
import {PortInfo} from "@serialport/bindings-interface/dist/index.js";
import {Exclude} from "class-transformer";
import Device from "./device.js";

@Exclude()
export default abstract class SerialDevice extends Device
{
    protected readonly portInfo: PortInfo;
    protected readonly syncPort: SynchronousSerialPort;

    protected constructor(
        deviceId: string,
        deviceName: string,
        connectedSince: Date,
        syncPort: SynchronousSerialPort,
        portInfo: PortInfo,
        controllable: boolean
    ) {
        super(deviceId, deviceName, connectedSince, controllable);
        this.syncPort = syncPort;
        this.portInfo = portInfo;
    }

    public get getPortInfo(): PortInfo
    {
        return this.portInfo;
    }
}
