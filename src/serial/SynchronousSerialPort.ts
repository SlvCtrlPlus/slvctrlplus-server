import {Readable, Writable} from "stream";
import {CancellationToken, cancellationTokenReasons, SequentialTaskQueue, TaskOptions} from "sequential-task-queue";

export default class SynchronousSerialPort {
    private reader: Readable;

    private writer: Writable;

    private pending = false;

    private lastSend: Date|null;

    private lastReceive: Date|null;

    private readonly queue: SequentialTaskQueue;

    public constructor(reader: Readable, writer: Writable) {
        this.reader = reader;
        this.writer = writer;
        this.queue = new SequentialTaskQueue();
        this.queue.on('error', (error: unknown) => {
            console.log('Error in queued task:');
            console.log(error);
        });
    }

    public writeAndExpect(data: string, timeoutMs = 1000): Promise<string> {
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

        return this.queue.push((token: CancellationToken) => promise.then(response => {
            if (token.cancelled) {
                let reason = `unknown`;

                if (token.reason === cancellationTokenReasons.timeout) {
                    reason = 'timeout';
                } else if (token.reason === cancellationTokenReasons.cancel) {
                    reason = 'manual';
                }

                console.log(`Task cancelled. Reason: ${reason}`);

                if (null !== removeListeners) {
                    removeListeners();
                }
            }

            return response;
        }), options) as unknown as Promise<string>;
    }

    public writeLineAndExpect(data: string, timeoutMs = 1000): Promise<string> {
        return this.writeAndExpect(data + '\n', timeoutMs)
    }
}
