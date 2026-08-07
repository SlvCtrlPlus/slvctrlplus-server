import { SerialPort, SerialPortOpenOptions } from 'serialport';
import { SerialPortStream } from '@serialport/stream';
import { AutoDetectTypes } from '@serialport/bindings-cpp';

export default class SerialPortFactory
{
    public create(options: SerialPortOpenOptions<AutoDetectTypes>): SerialPortStream {
        return new SerialPort(options);
    }
}
