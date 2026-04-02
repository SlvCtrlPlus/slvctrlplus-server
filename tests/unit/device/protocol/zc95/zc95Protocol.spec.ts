import { describe, expect, it } from 'vitest';
import Zc95Protocol from '../../../../../src/device/protocol/zc95/zc95Protocol.js';
import { expectToBeErrorDecodeResult, expectToBeSuccessfulDecodeResult } from '../../../helper/protocol.js';

describe('Zc95Protocol', () => {

    const protocol = new Zc95Protocol();

    describe('encode', () => {
        it('serializes the message object to a JSON Buffer', () => {
            const msg = { Type: 'PatternList', MsgId: 3, Data: 'foo' };

            const result = protocol.encode(msg);

            expect(result).toBeInstanceOf(Buffer);
            expect(JSON.parse(result.toString('utf-8'))).toStrictEqual(msg);
        });
    });

    describe('decode', () => {
        it('parses a valid JSON buffer to a message object', () => {
            const obj = { Type: 'Ack', MsgId: 1, Result: 'OK' };

            const result = protocol.decode(Buffer.from(JSON.stringify(obj)));

            expectToBeSuccessfulDecodeResult(result);
            expect(result.message).toStrictEqual(obj);
        });

        it('returns an error result for invalid JSON', () => {
            const result = protocol.decode(Buffer.from('not-valid-json{{'));

            expectToBeErrorDecodeResult(result);
            expect(result.error.type).toStrictEqual('invalid_frame');
        });
    });

    describe('isResponseMatchingMessage', () => {
        it('returns true when MsgId and Type match the responseIdentifier', () => {
            const msg = Zc95Protocol.createMessage({ Type: 'DoSomething', MsgId: 7 }, 'Ack');
            const response = { Type: 'Ack', MsgId: 7, Result: 'OK' as const };

            expect(protocol.isResponseMatchingMessage(response, msg)).toBe(true);
        });

        it('returns false when MsgId does not match', () => {
            const msg = Zc95Protocol.createMessage({ Type: 'DoSomething', MsgId: 7 }, 'Ack');
            const response = { Type: 'Ack', MsgId: 8, Result: 'OK' as const };

            expect(protocol.isResponseMatchingMessage(response, msg)).toBe(false);
        });

        it('returns false when Type does not match', () => {
            const msg = Zc95Protocol.createMessage({ Type: 'DoSomething', MsgId: 7 }, 'Ack');
            const response = { Type: 'PatternDetail', MsgId: 7, Result: 'OK' as const };

            expect(protocol.isResponseMatchingMessage(response, msg)).toBe(false);
        });
    });

    describe('createMessage', () => {
        it('creates a message with the correct fields and responseIdentifier', () => {
            const innerMsg = { Type: 'PatternList', MsgId: 3 };

            const result = Zc95Protocol.createMessage(innerMsg, 'PatternListData');

            expect(result.message).toStrictEqual(innerMsg);
            expect(result.responseType).toBeUndefined();
            expect(result.responseIdentifier).toStrictEqual({ msgId: 3, type: 'PatternListData' });
        });
    });
});
