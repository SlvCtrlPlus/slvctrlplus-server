import { Transform, TransformCallback, TransformOptions } from 'stream';

export interface FrameParserOptions extends TransformOptions
{
    stx: number;
    etx: number;
    maxMessageSize?: number;
}

type State = 'IDLE' | 'RECV';

export class FrameParser extends Transform
{
    private readonly stx: number;
    private readonly etx: number;
    private readonly maxMessageSize: number;

    private state: State = 'IDLE';
    private buffer: number[] = [];

    public constructor(options: FrameParserOptions) {
        super({ ...options, readableObjectMode: true });

        this.stx = options.stx;
        this.etx = options.etx;
        this.maxMessageSize = options.maxMessageSize ?? 4096;
    }

    public _transform(chunk: Buffer, _: BufferEncoding, callback: TransformCallback) {
        for (const byte of chunk) {
            if (this.state === 'IDLE') {
                if (byte === this.stx) {
                    this.state = 'RECV';
                    this.buffer = [];
                }
                continue;
            }

            // RECV state
            if (byte === this.etx) {
                this.push(Buffer.from(this.buffer));
                this.state = 'IDLE';
                this.buffer = [];
                continue;
            }

            this.buffer.push(byte);

            if (this.buffer.length >= this.maxMessageSize) {
                this.destroy(new Error(`Frame size exceeded maximum of ${this.maxMessageSize} bytes`));
                return;
            }
        }

        callback();
    }

    public _flush(callback: TransformCallback) {
        this.state = 'IDLE';
        this.buffer = [];
        callback();
    }
}