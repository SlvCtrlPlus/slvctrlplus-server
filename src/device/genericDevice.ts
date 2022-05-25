import SynchronousSerialPort from "../serial/SynchronousSerialPort.js";
import {PortInfo} from "@serialport/bindings-interface/dist/index.js";
import {Exclude} from "class-transformer";
import Device from "./device.js";

@Exclude()
export default class GenericDevice extends Device
{
    public constructor(deviceId: string, deviceName: string, connectedSince: Date, syncPort: SynchronousSerialPort, portInfo: PortInfo)
    {
        super(deviceId, deviceName, connectedSince, syncPort, portInfo, false);
    }
}
