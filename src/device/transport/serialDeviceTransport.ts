import DeviceTransport from "./deviceTransport.js";
import SynchronousSerialPort from "../../serial/SynchronousSerialPort.js";

export default class SerialDeviceTransport implements DeviceTransport
{
    private serialPort: SynchronousSerialPort;

    public constructor(serialPort: SynchronousSerialPort) {
        this.serialPort = serialPort;
    }

    public async sendAndAwaitReceive(str: string, timeout?: number): Promise<string> {
        return this.serialPort.writeAndExpect(str, timeout);
    }

    public async send(str: string): Promise<void> {
        return this.serialPort.write(str);
    }

    public receive(dataProcessor: (data: string) => void): void {
        this.serialPort.onData(dataProcessor);
    }

    public getDeviceIdentifier(): string {
        return this.serialPort.getPortInfo().serialNumber;
    }
}
