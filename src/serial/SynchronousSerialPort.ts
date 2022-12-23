import {Readable, Writable} from "stream";
import { timeout } from "promise-timeout";
import {SequentialTaskQueue} from "sequential-task-queue";
import {PromiseQueue} from "./PromiseQueue.js";

export default class SynchronousSerialPort {
    private reader: Readable;

    private writer: Writable;

    private pending = false;

    private lastSend: Date|null;

    private lastReceive: Date|null;

    private removeListeners: () => void;

    private readonly queue: SequentialTaskQueue;

    public constructor(reader: Readable, writer: Writable) {
        this.reader = reader;
        this.writer = writer;
        this.queue = new SequentialTaskQueue();
    }

    public writeAndExpect(data: string, timeoutMs = 1000): Promise<string> {
        let promise = new Promise<string>((resolve, reject) => {

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

        if (timeoutMs > 0) {
            promise = timeout(promise, timeoutMs).then(v => {
                this.removeListeners();
                return v;
            });
        }

        return this.queue.push(() => promise, {}) as unknown as Promise<string>;
    }

    public writeLineAndExpect(data: string, timeoutMs = 1000): Promise<string> {
        return this.writeAndExpect(data + '\n', timeoutMs)
    }
}
