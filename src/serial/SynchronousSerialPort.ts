import { Readable, Writable } from 'stream';
import { cancellationTokenReasons, SequentialTaskQueue, TaskOptions } from 'sequential-task-queue';
import { PortInfo } from '@serialport/bindings-interface';
import Logger from '../logging/Logger.js';

export default class SynchronousSerialPort
{
    private reader: Readable;

    private writer: Writable;

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
        return this.queue.push(() => new Promise<void>((resolve, reject) => {
            this.writer.write(data, (err: Error | null | undefined) => (err) ? reject(err) : resolve());
        }));
    }

    public onData(dataProcessor: (data: string) => void): void {
        this.reader.on('data', dataProcessor);
    }

    public async writeAndExpect(data: string, timeoutMs = 1000): Promise<string> {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        let removeListeners: () => void = () => {};

        // Very important to wrap the promise in a function: () => new Promise(...).
        // If not, it's immediately executed!
        const wrappedPromise = () => new Promise<string>((resolve, reject) => {
            const errorHandler = (err: Error) => {
                removeListeners();
                reject(err);
            };

            const dataHandler = (receivedData: string): void => {
                if (undefined !== removeListeners) {
                    removeListeners();
                }
                resolve(receivedData);
            };

            removeListeners = (): void => {
                this.reader.removeListener('data', dataHandler);
                this.reader.removeListener('error', errorHandler);
            }

            this.reader.on('data', dataHandler);
            this.reader.on('error', errorHandler);

            this.writer.write(data, (err: Error | null | undefined) => {
                if (err) {
                    removeListeners();
                    reject(err);
                }
            });
        });

        const options: TaskOptions = {};

        if (timeoutMs > 0) {
            options.timeout = timeoutMs;
        }

        try {
            return await this.queue.push(wrappedPromise, options) as Promise<string>;
        } catch (e) {
            let reason = `task cancelled for unknown reason`;

            if (e === cancellationTokenReasons.timeout) {
                reason = `task timed out (>${timeoutMs}ms)`;
            } else if (e === cancellationTokenReasons.cancel) {
                reason = 'task deliberately cancelled';
            }

            removeListeners();

            throw new Error(reason);
        }
    }

    public getPortInfo(): PortInfo {
        return this.portInfo;
    }
}
