import type SynchronousSerialPort from '../../serial/synchronousSerialPort.js';
import SerialDeviceTransport from './serialDeviceTransport.js';

export default class SerialDeviceTransportFactory
{
    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    public create(serialPort: SynchronousSerialPort, frameStartBytes?: Buffer, frameEndBytes?: Buffer): SerialDeviceTransport {
        return new SerialDeviceTransport(serialPort, frameStartBytes, frameEndBytes);
    }
}
