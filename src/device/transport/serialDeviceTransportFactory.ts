import DeviceTransport from "./DeviceTransport.js";
import SynchronousSerialPort from "../../serial/SynchronousSerialPort.js";

export default class SerialDeviceTransport implements DeviceTransport
{
    private serialPort: SynchronousSerialPort;

    public constructor(serialPort: SynchronousSerialPort) {
        this.serialPort = serialPort;
    }

    public async writeLineAndExpect(str: string, timeout: number): Promise<string> {
        return this.serialPort.writeLineAndExpect(str, timeout);
    }

    public getDeviceIdentifier(): string {
        return this.serialPort.getPortInfo().serialNumber;
    }
}
