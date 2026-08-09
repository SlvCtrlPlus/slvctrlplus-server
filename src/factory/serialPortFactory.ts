import type { SerialPortOpenOptions } from 'serialport';
import { SerialPort } from 'serialport';
import type { SerialPortStream } from '@serialport/stream';
import type { AutoDetectTypes } from '@serialport/bindings-cpp';

export default class SerialPortFactory
{
    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    public create(options: SerialPortOpenOptions<AutoDetectTypes>): SerialPortStream {
        return new SerialPort(options);
    }
}
