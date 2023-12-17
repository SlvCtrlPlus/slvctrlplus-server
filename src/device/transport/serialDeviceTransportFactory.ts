import SynchronousSerialPort from "../../serial/SynchronousSerialPort.js";
import SerialDeviceTransport from "./serialDeviceTransport.js";

export default class SerialDeviceTransportFactory
{
    public create(serialPort: SynchronousSerialPort): SerialDeviceTransport {
        return new SerialDeviceTransport(serialPort);
    }
}
