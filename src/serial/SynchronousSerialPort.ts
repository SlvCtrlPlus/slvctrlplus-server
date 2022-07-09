import {Readable, Writable} from "stream";
import { timeout } from "promise-timeout";

export default class SynchronousSerialPort {
    private reader: Readable;

    private writer: Writable;

    private pending: boolean = false;

    private lastSend: Date|null;

    private lastReceive: Date|null;

    private removeListeners: () => void;

    public constructor(reader: Readable, writer: Writable) {
        this.reader = reader;
        this.writer = writer;
    }

    public writeAndExpect(data: string, timeoutMs: number = 1000): Promise<string> {
        const promise = new Promise<string>((resolve, reject) => {

            if (this.pending) {
                // TODO send it to a buffer instead?
                const reqDurationMs = new Date().getMilliseconds() - this.lastSend.getMilliseconds();
                reject(new Error(`Request pending from ${this.lastSend.toISOString()} (duration: ${reqDurationMs}ms)`));
                return;
            }

            this.pending = true;

            const errorHandler = (err: Error) => {
                this.removeListeners();
                reject(err);
            };

            const dataHandler = (receivedData: string): void => {
                this.lastReceive = new Date();

                this.removeListeners();
                resolve(receivedData);
            };

            this.removeListeners = (): void => {
                this.reader.removeListener('data', dataHandler);
                this.reader.removeListener('error', errorHandler);
                this.pending = false;
            }

            this.reader.on('data', dataHandler);
            this.reader.on('error', errorHandler);

            this.lastSend = new Date();
            this.writer.write(data, (err: Error) => {
                if (err) {
                    this.removeListeners();
                    reject(err);
                }
            });
        });

        if (timeoutMs === 0) {
            return promise
        }

        return timeout(promise, timeoutMs).then(v => {
            this.removeListeners();
            return v;
        });
    }

    public writeLineAndExpect(data: string, timeoutMs: number = 1000): Promise<string> {
        return this.writeAndExpect(data + '\n', timeoutMs)
    }
}
