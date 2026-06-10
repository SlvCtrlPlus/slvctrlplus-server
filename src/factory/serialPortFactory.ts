import { SerialPort, SerialPortOpenOptions } from 'serialport';
import { SerialPortStream } from '@serialport/stream';
import { AutoDetectTypes } from '@serialport/bindings-cpp';
import { BindingInterface } from '@serialport/bindings-interface';

export default class SerialPortFactory
{
    public create(options: SerialPortOpenOptions<AutoDetectTypes>): SerialPortStream<BindingInterface> {
        return new SerialPort(options);
    }
}
