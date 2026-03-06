import SynchronousSerialPort from '../../serial/synchronousSerialPort.js';
import SerialDeviceTransport from './serialDeviceTransport.js';

export default class SerialDeviceTransportFactory
{
    public create(serialPort: SynchronousSerialPort, frameStartBytes?: Buffer, frameEndBytes?: Buffer): SerialDeviceTransport {
        return new SerialDeviceTransport(serialPort, frameStartBytes, frameEndBytes);
    }
}
