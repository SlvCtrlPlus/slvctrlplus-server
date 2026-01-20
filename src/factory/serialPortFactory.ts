import { SerialPort, SerialPortOpenOptions } from 'serialport';
import { AutoDetectTypes } from '@serialport/bindings-cpp';

export default class SerialPortFactory
{
    public create(options: SerialPortOpenOptions<AutoDetectTypes>): SerialPort {
        return new SerialPort(options);
    }
}
