import {Readable, Writable} from "stream";
import {cancellationTokenReasons, SequentialTaskQueue, TaskOptions} from "sequential-task-queue";
import {PortInfo} from "@serialport/bindings-interface/dist/index.js";
import Logger from "../logging/Logger.js";

export default class SynchronousSerialPort {
    private reader: Readable;

    private writer: Writable;

    private pending = false;

    private lastSend: Date|null;

    private lastReceive: Date|null;

    private readonly portInfo: PortInfo;

    private readonly queue: SequentialTaskQueue;

    private readonly logger: Logger;

    public constructor(portInfo: PortInfo, reader: Readable, writer: Writable, logger: Logger) {
        this.portInfo = portInfo;
        this.reader = reader;
        this.writer = writer;
        this.queue = new SequentialTaskQueue();
        this.logger = logger;
        this.queue.on('error', (error: unknown) => {
            this.logger.error(`Error in queued task: ${(error as Error).message}`, error)
        });
    }

    public async write(data: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.writer.write(data, (err: Error) => {
                if (err) {
                    reject(err);
                }
            });

            resolve();
        });
    }

    public onData(dataProcessor: (data: string) => void): void {
       this.reader.on('data', dataProcessor);
    }

    public async writeAndExpect(data: string, timeoutMs = 1000): Promise<string> {
        let removeListeners: () => void = null;

        const promise = new Promise<string>((resolve, reject) => {

            this.pending = true;

            const errorHandler = (err: Error) => {
                if (null !== removeListeners) {
                    removeListeners();
                }
                reject(err);
            };

            const dataHandler = (receivedData: string): void => {
                this.lastReceive = new Date();

                if (null !== removeListeners) {
                    removeListeners();
                }
                resolve(receivedData);
            };

            removeListeners = (): void => {
                this.reader.removeListener('data', dataHandler);
                this.reader.removeListener('error', errorHandler);
                this.pending = false;
            }

            this.reader.on('data', dataHandler);
            this.reader.on('error', errorHandler);

            this.lastSend = new Date();
            this.writer.write(data, (err: Error) => {
                if (err) {
                    removeListeners();
                    reject(err);
                }
            });
        });

        const options = {} as TaskOptions;

        if (timeoutMs > 0) {
            options.timeout = timeoutMs;
        }

        try {
            return await this.queue.push(() => promise, options) as unknown as Promise<string>;
        } catch (e) {
            let reason = `task cancelled for unknown reason`;

            if (e === cancellationTokenReasons.timeout) {
                reason = `task timed out (>${timeoutMs}ms)`;
            } else if (e === cancellationTokenReasons.cancel) {
                reason = 'task deliberately cancelled';
            }

            if (null !== removeListeners) {
                removeListeners();
            }

            throw new Error(reason);
        }
    }

    public getPortInfo(): PortInfo
    {
        return this.portInfo;
    }
}
