import type { Readable } from 'stream';
import type { SerialPortStream } from '@serialport/stream';
import type { TaskOptions } from '@timesplinter/sequential-task-queue';
import { cancellationTokenReasons, SequentialTaskQueue } from '@timesplinter/sequential-task-queue';
import type { PortInfo } from '@serialport/bindings-interface';
import type Logger from '../logging/Logger.js';
import { logError } from '../util/error.js';

type CloseHandler = () => void | Promise<void>;

export default class SynchronousSerialPort
{
    private readonly reader: Readable;

    private readonly writer: SerialPortStream;

    private readonly portInfo: PortInfo;

    private readonly queue: SequentialTaskQueue;

    private readonly logger: Logger;

    private closed = false;

    private closePromise?: Promise<void>;

    private readonly closeSubscribers: CloseHandler[] = [];

    private readonly handleStreamClose = (): void => {
        this.close().catch((err: unknown) => logError(this.logger, 'Error closing serial port after stream close', err));
    };

    public constructor(portInfo: PortInfo, reader: Readable, writer: SerialPortStream, logger: Logger) {
        this.portInfo = portInfo;
        this.reader = reader;
        this.writer = writer;
        this.queue = new SequentialTaskQueue();
        this.logger = logger;
        this.queue.on('error', (error: unknown) => logError(this.logger, 'Error in queued task', error));

        this.writer.on('close', this.handleStreamClose);
        this.reader.on('close', this.handleStreamClose);
    }

    public async write(data: Buffer): Promise<void> {
        return this.queue.push(async () => new Promise<void>((resolve, reject) => {
            this.writer.write(data, (err: Error | null | undefined) => (err) ? reject(err) : resolve());
        }));
    }

    public onData(dataProcessor: (data: Buffer) => void): void {
        this.reader.on('data', dataProcessor);
    }

    public onClose(handler: CloseHandler): void {
        this.closeSubscribers.push(handler);
    }

    public isOpen(): boolean {
        return !this.closed && this.writer.writable && this.reader.readable;
    }

    public async close(): Promise<void> {
        if (undefined !== this.closePromise) {
            return this.closePromise;
        }

        this.closePromise = this.doClose();

        return this.closePromise;
    }

    public async writeAndExpect(data: Buffer, timeoutMs = 1000): Promise<Buffer> {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        let removeListeners: () => void = () => {};

        // Very important to wrap the promise in a function: () => new Promise(...).
        // If not, it's immediately executed!
        const wrappedPromise = async (): Promise<Buffer> => new Promise((resolve, reject) => {
            const errorHandler = (err: Error): void => {
                removeListeners();
                reject(err);
            };

            const dataHandler = (receivedData: Buffer): void => {
                removeListeners();
                resolve(receivedData);
            };

            removeListeners = (): void => {
                this.reader.removeListener('data', dataHandler);
                this.reader.removeListener('error', errorHandler);
            };

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
            return await this.queue.push(wrappedPromise, options);
        } catch (e: unknown) {
            removeListeners();

            let reason = `task cancelled for unknown reason`;

            if (e === cancellationTokenReasons.timeout) {
                reason = `task timed out (>${timeoutMs}ms)`;
            } else if (e === cancellationTokenReasons.cancel) {
                reason = 'task deliberately cancelled';
            }

            throw new Error(reason, { cause: e });
        }
    }

    public getPortInfo(): PortInfo {
        return this.portInfo;
    }

    private async doClose(): Promise<void> {
        this.closed = true;
        void this.queue.close(true);
        this.writer.off('close', this.handleStreamClose);
        this.reader.off('close', this.handleStreamClose);

        if (this.writer.isOpen) {
            await new Promise<void>(resolve => {
                this.writer.close(err => {
                    if (err) {
                        logError(this.logger, `Error while closing serial port '${this.portInfo.path}'`, err);
                    }
                    resolve();
                });
            });
        }

        this.writer.destroy();
        this.reader.destroy();

        for (const subscriber of this.closeSubscribers) {
            try {
                await subscriber();
            } catch (e: unknown) {
                logError(this.logger, 'Error in writer/reader close handler', e);
            }
        }
    }
}
