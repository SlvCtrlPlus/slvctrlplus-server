import { SerialPort } from 'serialport';
import Zc95SerialReader from "./Zc95SerialReader.js";
import {MsgResponse} from "./Zc95Messages";
import Logger from "../../../logging/Logger";

const STX = 0x02;
const ETX = 0x03;
const EOT = 0x04;

export class Zc95Serial {
    private port: SerialPort;
    private reader: Zc95SerialReader;
    private rcvQueue: MsgResponse[];

    private recvWaiting = false;
    private pendingRecvMessage: MsgResponse;
    private waitingForMsgId = 0;

    private connectionReady: Promise<void>;

    private logger: Logger;

    public constructor(serialPort: SerialPort, rcvQueue: MsgResponse[], logger: Logger) {
        this.logger = logger;
        this.rcvQueue = rcvQueue;

        this.port = serialPort;

        this.reader = new Zc95SerialReader();

        // 1. Forward incoming bytes to reader
        this.port.on('data', (data: Buffer) => this.reader.onData(data));

        // 2. Handle complete messages
        this.reader.on('receive', (msg: string) => this.onMessage(msg));
        this.reader.on('error', (error: Error) => this.logger.error(`Reader error: ${error.message}`, error));
    }

    private onMessage(message: string): void {
        this.logger.trace(`< ${message}`);

        try {
            const result = JSON.parse(message) as MsgResponse;
            if (this.recvWaiting && result.MsgId === this.waitingForMsgId) {
                this.pendingRecvMessage = result;
                this.recvWaiting = false;
            } else {
                this.rcvQueue.push(result);
            }
        } catch (e: unknown) {
            // In case of parsing error, just log it and throw the message away
            this.logger.warn(`Error parsing incoming message: ${message} -> ${(e as Error).message}`, e);
        }
    }

    public async waitForConnection(): Promise<void> {
        await this.connectionReady;
    }

    public send(message: string) {
        this.logger.trace(`> ${message}`);

        const buffer = Buffer.concat([
            Buffer.from([STX]),
            Buffer.from(message, 'utf-8'),
            Buffer.from([ETX]),
        ]);

        this.port.write(buffer);
    }

    public async recv(msgId: number, timeoutMs = 6000): Promise<MsgResponse | null> {
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

    public reset(close: boolean = true): Promise<void> {
        return new Promise(resolve => {
            this.port.write(Buffer.from([EOT]), () => {
                if (close) this.port.close();
            });
            setTimeout(resolve, 250);
            this.logger.trace('> EOT');
        });
    }
}
