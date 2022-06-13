import {Readable, Writable} from "stream";
import { timeout } from "promise-timeout";

export default class SynchronousSerialPort {
    private reader: Readable;

    private writer: Writable;

    public constructor(reader: Readable, writer: Writable) {
        this.reader = reader;
        this.writer = writer;
    }

    public writeAndExpect(data: string, timeoutMs: number = 1000): Promise<string> {
        const promise = new Promise<string>((resolve, reject) => {

            const errorHandler = (err: Error) => {
                console.log(err);
                reject(err);
            };

            const dataHandler = (receivedData: string): void => {
                this.reader.removeListener('data', dataHandler);
                this.reader.removeListener('error', errorHandler);

                resolve(receivedData);
            };

            this.reader.on('data', dataHandler);
            this.reader.on('error', errorHandler);

            this.writer.write(data, (err: Error) => {
                if (err) {
                    reject(err);
                }
            });
        });

        if (timeoutMs === 0) {
            return promise
        }

        return timeout(promise, timeoutMs);
    }

    public writeLineAndExpect(data: string, timeoutMs: number = 1000): Promise<string> {
        return this.writeAndExpect(data + '\n', timeoutMs)
    }
}
