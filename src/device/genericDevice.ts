import SynchronousSerialPort from "../serial/SynchronousSerialPort.js";
import {PortInfo} from "@serialport/bindings-interface/dist/index.js";
import {Exclude} from "class-transformer";
import SerialDevice from "./serialDevice.js";

@Exclude()
export default class GenericDevice extends SerialDevice
{
    public constructor(deviceId: string, deviceName: string, connectedSince: Date, syncPort: SynchronousSerialPort, portInfo: PortInfo)
    {
        super(deviceId, deviceName, connectedSince, syncPort, portInfo, false);
    }

    public refreshData(): void {
        // no-op
    }
}
