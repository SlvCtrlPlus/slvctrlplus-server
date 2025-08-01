import {EventEmitter} from "events";

const STX = 0x02;
const ETX = 0x03;

export default class Zc95SerialReader extends EventEmitter {
    private state: 'IDLE' | 'RECV' = 'IDLE';
    private message: number[] = [];

    public constructor() {
        super();
    }

    public onData(data: Buffer) {
        for (const byte of data) {
            if (this.state === 'IDLE') {
                if (byte === STX) {
                    this.state = 'RECV';
                    this.message = [];
                }
            } else if (this.state === 'RECV') {
                if (byte === ETX) {
                    const messageString = Buffer.from(this.message).toString('utf-8');
                    this.emit('receive', messageString);
                    this.state = 'IDLE';
                } else {
                    this.message.push(byte);
                }
            }
        }
    }
}