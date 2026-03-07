import { describe, expect, it } from 'vitest';
import { FrameParser, FrameParserOptions } from '../../../src/serial/frameParser.js';

const STX = 0x02;
const ETX = 0x03;

const options: FrameParserOptions = { stx: STX, etx: ETX };

function feedChunks(parser: FrameParser, ...chunks: Buffer[]): Buffer[] {
    const frames: Buffer[] = [];
    parser.on('data', (frame: Buffer) => frames.push(frame));
    for (const chunk of chunks) {
        parser.write(chunk);
    }
    return frames;
}

describe('FrameParser', () => {
    it('parses a single complete frame in one chunk', () => {
        const parser = new FrameParser(options);
        const frames = feedChunks(
            parser,
            Buffer.from([STX, ...Buffer.from('hello world'), ETX])
        );

        expect(frames).toHaveLength(1);
        expect(frames[0].toString()).toBe('hello world');
    });

    it('parses a frame split across multiple chunks', () => {
        const parser = new FrameParser(options);
        const frames = feedChunks(
            parser,
            Buffer.from([STX, ...Buffer.from('hel')]),
            Buffer.from([...Buffer.from('lo'), ETX])
        );

        expect(frames).toHaveLength(1);
        expect(frames[0].toString()).toBe('hello');
    });

    it('parses multiple frames in a single chunk', () => {
        const parser = new FrameParser(options);
        const frames = feedChunks(
            parser,
            Buffer.from([STX, ...Buffer.from('foo'), ETX, STX, ...Buffer.from('bar'), ETX])
        );

        expect(frames).toHaveLength(2);
        expect(frames[0].toString()).toBe('foo');
        expect(frames[1].toString()).toBe('bar');
    });

    it('ignores bytes outside of STX/ETX boundaries', () => {
        const parser = new FrameParser(options);
        const frames = feedChunks(
            parser,
            Buffer.from([0x00, 0xff, STX, ...Buffer.from('hello'), ETX, 0x00])
        );

        expect(frames).toHaveLength(1);
        expect(frames[0].toString()).toBe('hello');
    });

    it('emits an error and destroys when frame exceeds maxMessageSize', async () => {
        const parser = new FrameParser({ ...options, maxMessageSize: 4 });
        const frames: Buffer[] = [];

        parser.on('data', (frame: Buffer) => frames.push(frame));

        const error = await new Promise<Error>(resolve => {
            parser.on('error', resolve);
            parser.write(Buffer.from([STX, 0x41, 0x42, 0x43, 0x44, 0x45, ETX]));
        });

        expect(frames).toHaveLength(0);
        expect(error.message).toContain('Frame size exceeded maximum of 4 bytes');
    });

    it('handles an empty frame', () => {
        const parser = new FrameParser(options);
        const frames = feedChunks(
            parser,
            Buffer.from([STX, ETX])
        );

        expect(frames).toHaveLength(1);
        expect(frames[0].byteLength).toBe(0);
    });

    it('ignores incomplete frame on flush', () => {
        const parser = new FrameParser(options);
        const frames = feedChunks(
            parser,
            Buffer.from([])
        );

        parser.write(Buffer.from([STX, ...Buffer.from('incomplete')]));
        parser.end();

        expect(frames).toHaveLength(0);
    });
});
