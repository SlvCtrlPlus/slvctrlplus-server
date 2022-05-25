import {Readable, Writable} from "stream";

export default class SynchronousSerialPort {
    private reader: Readable;

    private writer: Writable;

    public constructor(reader: Readable, writer: Writable) {
        this.reader = reader;
        this.writer = writer;
    }

    public writeAndExpect(data: string): Promise<string> {
        return new Promise((resolve, reject) => {

            const errorHandler = (err: Error) => {
                console.log(err);
                reject(err);
            };

            const dataHandler = (receivedData: string): void => {
                resolve(receivedData);

                this.reader.removeListener('data', dataHandler);
                this.reader.removeListener('error', errorHandler);
            };

            this.reader.on('data', dataHandler);
            this.reader.on('error', errorHandler);

            this.writer.write(data, (err: Error) => {
                if (err) {
                    reject(err);
                }
            });
        });
    }

    public writeLineAndExpect(data: string): Promise<string> {
        return this.writeAndExpect(data + '\n')
    }
}
