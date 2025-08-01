import { SerialPort } from 'serialport';
import Zc95SerialReader from "./Zc95SerialReader.js";

const STX = 0x02;
const ETX = 0x03;
const EOT = 0x04;

export class Zc95Serial {
    private port: SerialPort;
    private reader: Zc95SerialReader;
    private rcvQueue: any[];
    private debug: boolean;

    private recvWaiting = false;
    private pendingRecvMessage: string = '';
    private waitingForMsgId = 0;

    private connectionReady: Promise<void>;

    public constructor(serialPort: SerialPort, rcvQueue: any[], debug = false) {
        this.debug = debug;
        this.rcvQueue = rcvQueue;

        this.port = serialPort;

        this.reader = new Zc95SerialReader();

        // Forward incoming bytes to reader
        this.port.on('data', (data: Buffer) => this.reader.onData(data));

        // Handle parsed messages
        this.reader.on('receive', this.onMessage.bind(this));
    }

    private onMessage(message: string) {
        if (this.debug) console.log('<', message);

        const result = JSON.parse(message);
        if (this.recvWaiting && result.MsgId === this.waitingForMsgId) {
            this.pendingRecvMessage = message;
            this.recvWaiting = false;
        } else {
            this.rcvQueue.push(result);
        }
    }

    public async waitForConnection(): Promise<void> {
        await this.connectionReady;
    }

    public send(message: string) {
        if (this.debug) console.log('>', message);

        const buffer = Buffer.concat([
            Buffer.from([STX]),
            Buffer.from(message, 'utf-8'),
            Buffer.from([ETX]),
        ]);

        this.port.write(buffer);
    }

    public async recv(msgId: number, timeoutMs = 6000): Promise<string | null> {
        this.waitingForMsgId = msgId;
        this.recvWaiting = true;

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.recvWaiting = false;
                resolve(null);
            }, timeoutMs);

            const check = setInterval(() => {
                if (!this.recvWaiting) {
                    clearTimeout(timeout);
                    clearInterval(check);
                    resolve(this.pendingRecvMessage);
                }
            }, 50);
        });
    }

    public runForever() {
        // No-op (could be used for heartbeat in the future)
    }

    public stop() {
        this.port.write(Buffer.from([EOT]), () => {
            this.port.close();
        });
    }
}
