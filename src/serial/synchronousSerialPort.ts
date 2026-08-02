import { Readable } from 'stream';
import { SerialPortStream } from '@serialport/stream';
import { cancellationTokenReasons, SequentialTaskQueue, TaskOptions } from '@timesplinter/sequential-task-queue';
import { BindingInterface, PortInfo } from '@serialport/bindings-interface';
import Logger from '../logging/Logger.js';
import { asyncHandler } from '../util/async.js';
import { logError } from '../util/error.js';

export default class SynchronousSerialPort
{
    private reader: Readable;

    private writer: SerialPortStream<BindingInterface>;

    private readonly portInfo: PortInfo;

    private readonly queue: SequentialTaskQueue;

    private readonly logger: Logger;

    private closed = false;

    private closePromise?: Promise<void>;

    public constructor(portInfo: PortInfo, reader: Readable, writer: SerialPortStream<BindingInterface>, logger: Logger) {
        this.portInfo = portInfo;
        this.reader = reader;
        this.writer = writer;
        this.queue = new SequentialTaskQueue();
        this.logger = logger;
        this.queue.on('error', (error: unknown) => logError(this.logger, 'Error in queued task', error));
    }

    public async write(data: Buffer): Promise<void> {
        return this.queue.push(() => new Promise<void>((resolve, reject) => {
            this.writer.write(data, (err: Error | null | undefined) => (err) ? reject(err) : resolve());
        }));
    }

    public onData(dataProcessor: (data: Buffer) => void): void {
        this.reader.on('data', dataProcessor);
    }

    public onClose(callback: () => Promise<void>): void {
        const runClose = asyncHandler(
            callback,
            (e: unknown) => logError(this.logger, 'Error in writer/reader close handler', e)
        );

        const handleClose = (): void => {
            // If we're already closed, this event is a side effect of our own close() (which
            // destroys the writer/reader after releasing the port), not a physical disconnect -
            // the callback already runs via that close() chain, so don't trigger it again here.
            const isPhysicalDisconnect = !this.closed;

            this.closed = true;
            void this.queue.close(true);
            // Prevent second call and clean up listeners
            this.writer.off('close', handleClose);
            this.reader.off('close', handleClose);

            if (isPhysicalDisconnect) {
                runClose();
            }
        };

        this.writer.on('close', handleClose);
        this.reader.on('close', handleClose);
    }

    public isOpen(): boolean {
        return !this.closed && this.writer.writable && this.reader.readable;
    }

    // Returns a promise resolved only once the underlying port is actually released. Generic
    // stream end()/destroy() alone doesn't release the OS-level handle - SerialPortStream only
    // does that from its own close(), so skipping it left the path locked and unable to be
    // reopened by a later reconnect (e.g. after a device source is disabled then re-enabled).
    public close(): Promise<void> {
        if (undefined !== this.closePromise) {
            return this.closePromise;
        }

        this.closed = true;
        void this.queue.close(true);

        this.closePromise = new Promise<void>((resolve) => {
            const finish = (): void => {
                this.writer.destroy();
                this.reader.destroy();
                resolve();
            };

            if (!this.writer.isOpen) {
                finish();
                return;
            }

            this.writer.close((err) => {
                if (err) {
                    logError(this.logger, `Error while closing serial port '${this.portInfo.path}'`, err);
                }
                finish();
            });
        });

        return this.closePromise;
    }

    public async writeAndExpect(data: Buffer, timeoutMs = 1000): Promise<Buffer> {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        let removeListeners: () => void = () => {};

        // Very important to wrap the promise in a function: () => new Promise(...).
        // If not, it's immediately executed!
        const wrappedPromise = (): Promise<Buffer> => new Promise((resolve, reject) => {
            const errorHandler = (err: Error): void => {
                removeListeners();
                reject(err);
            };

            const dataHandler = (receivedData: Buffer): void => {
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
            return await this.queue.push(wrappedPromise, options);
        } catch (e) {
            let reason = `task cancelled for unknown reason`;

            if (e === cancellationTokenReasons.timeout) {
                reason = `task timed out (>${timeoutMs}ms)`;
            } else if (e === cancellationTokenReasons.cancel) {
                reason = 'task deliberately cancelled';
            }

            removeListeners();

            throw new Error(reason, { cause: e });
        }
    }

    public getPortInfo(): PortInfo {
        return this.portInfo;
    }
}
