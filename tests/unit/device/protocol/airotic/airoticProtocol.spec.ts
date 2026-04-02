import { describe, expect, it } from 'vitest';
import AiroticProtocol from '../../../../../src/device/protocol/airotic/airtonicProtocol.js';
import { expectToBeSuccessfulDecodeResult } from '../../../helper/protocol.js';

describe('AiroticProtocol', () => {
    const protocol = new AiroticProtocol();

    describe('encode', () => {
        it('returns the same buffer that was passed in', () => {
            const input = Buffer.from('!H', 'utf8');

            const result = protocol.encode(input);

            expect(result).toBe(input);
        });
    });

    describe('decode', () => {
        it('decodes buffer to a utf-8 string message', () => {
            const input = Buffer.from('Hello I am bottle v2.0', 'utf8');

            const result = protocol.decode(input);

            expectToBeSuccessfulDecodeResult(result);
            expect(result.message).toStrictEqual('Hello I am bottle v2.0');
        });
    });

    describe('isResponseMatchingMessage', () => {
        it('matches the hello message when response starts with the hello prefix', () => {
            const msg = AiroticProtocol.createHelloMessage();

            expect(protocol.isResponseMatchingMessage('Hello I am bottle v2.0', msg)).toBe(true);
        });

        it('does not match the hello message when response has a different prefix', () => {
            const msg = AiroticProtocol.createHelloMessage();

            expect(protocol.isResponseMatchingMessage('Unknown response', msg)).toBe(false);
        });

        it('does not match when message is not the hello message', () => {
            const msg = AiroticProtocol.createSetColorMessage(255, 0, 0);

            expect(protocol.isResponseMatchingMessage('Hello I am bottle v2.0', msg)).toBe(false);
        });
    });

    describe('createHelloMessage', () => {
        it('returns a !H buffer with responseType field (MessageWithResponse)', () => {
            const msg = AiroticProtocol.createHelloMessage();

            expect(msg.message).toStrictEqual(Buffer.from('!H', 'utf8'));
            expect('responseType' in msg).toBe(true);
            expect(msg.responseType).toBeUndefined();
        });
    });

    describe('createSelectRestColorMessage', () => {
        it('returns a !B1 buffer without responseType (fire-and-forget)', () => {
            const msg = AiroticProtocol.createSelectRestColorMessage();

            expect(msg.message).toStrictEqual(Buffer.from('!B1', 'utf8'));
            expect('responseType' in msg).toBe(false);
        });
    });

    describe('createSelectBreathInColorMessage', () => {
        it('returns a !B2 buffer without responseType (fire-and-forget)', () => {
            const msg = AiroticProtocol.createSelectBreathInColorMessage();

            expect(msg.message).toStrictEqual(Buffer.from('!B2', 'utf8'));
            expect('responseType' in msg).toBe(false);
        });
    });

    describe('createSetColorMessage', () => {
        it('returns !C prefix followed by the raw RGB bytes', () => {
            const msg = AiroticProtocol.createSetColorMessage(10, 128, 255);

            const expected = Buffer.concat([Buffer.from('!C', 'utf8'), Buffer.from([10, 128, 255])]);
            expect(msg.message).toStrictEqual(expected);
            expect('responseType' in msg).toBe(false);
        });

        it('handles boundary values 0 and 255 correctly', () => {
            const msg = AiroticProtocol.createSetColorMessage(0, 255, 0);

            expect(msg.message[2]).toBe(0);
            expect(msg.message[3]).toBe(255);
            expect(msg.message[4]).toBe(0);
        });
    });

    describe('createResetColorsMessage', () => {
        it('returns a !B3 buffer without responseType', () => {
            const msg = AiroticProtocol.createResetColorsMessage();

            expect(msg.message).toStrictEqual(Buffer.from('!B3', 'utf8'));
            expect('responseType' in msg).toBe(false);
        });
    });

    describe('createRebootMessage', () => {
        it('returns a !B4 buffer without responseType', () => {
            const msg = AiroticProtocol.createRebootMessage();

            expect(msg.message).toStrictEqual(Buffer.from('!B4', 'utf8'));
            expect('responseType' in msg).toBe(false);
        });
    });
});
