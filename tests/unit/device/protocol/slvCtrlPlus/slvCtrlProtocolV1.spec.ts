import {describe, it, expect} from "vitest";
import { Kind, TypeGuard } from '@sinclair/typebox';
import SlvCtrlProtocolV1 from '../../../../../src/device/protocol/slvCtrlPlus/slvCtrlProtocolV1.js';
import { expectToBeErrorDecodeResult, expectToBeSuccessfulDecodeResult } from '../../../helper/protocol.js';
import { SlvCtrlProtocolCommand } from '../../../../../src/device/protocol/slvCtrlPlus/slvCtrlProtocol.js';

describe('slvCtrlProtocolV1', () => {

    it.each([
        {
            command: { command: 'set', args: ['attrName', 42] } satisfies SlvCtrlProtocolCommand,
            encodedCommand: 'set attrName 42'
        },
        {
            command: { command: 'set', args: ['attrName', false] } satisfies SlvCtrlProtocolCommand,
            encodedCommand: 'set attrName 0'
        },
        {
            command: { command: 'set', args: ['attrName', true] } satisfies SlvCtrlProtocolCommand,
            encodedCommand: 'set attrName 1'
        },
        {
            command: { command: 'set', args: ['attrName', 'foo'] } satisfies SlvCtrlProtocolCommand,
            encodedCommand: 'set attrName foo'
        },
        {
            command: { command: 'introduce', args: [] } satisfies SlvCtrlProtocolCommand,
            encodedCommand: 'introduce'
        },
    ])('encodes command to $encodedCommand', async ({ command, encodedCommand }) => {
        // Arrange
        const protocol = new SlvCtrlProtocolV1();

        // Act
        const result = protocol.encode(command)

        // Assert
        expect(result.toString('utf-8')).toStrictEqual(encodedCommand);
    });

    it('parses a successful device attribute response', async () => {

        // Arrange
        const response = "attributes;connected:ro[bool],adc:rw[bool],mode:rw[int(118..140)],levelA:rw[int],levelB:rw[str(foo|bar|baz)],levelC:wo[str],levelD:rw[float],levelE:rw[int(1|2)];status:ok";

        const protocol = new SlvCtrlProtocolV1();

        // Act
        const decodedResponse = protocol.decode(Buffer.from(response));

        expectToBeSuccessfulDecodeResult(decodedResponse);

        const result = protocol.getAttributes(decodedResponse.message.data);

        // Assert
        expect(TypeGuard.IsObject(result.schema)).toBe(true);

        if (!TypeGuard.IsObject(result.schema)) {
            return;
        }

        const { properties: props } = result.schema;
        expect(Object.keys(props).length).toBe(8);

        // connected: ro[bool]
        expect(props['connected']?.[Kind]).toBe('Boolean');
        expect(props['connected']?.readOnly).toBe(true);
        expect(result.data.connected).toBeUndefined();

        // adc: rw[bool]
        expect(props['adc']?.[Kind]).toBe('Boolean');
        expect(props['adc']?.readOnly).toBeUndefined();
        expect(props['adc']?.writeOnly).toBeUndefined();
        expect(result.data.adc).toBeUndefined();

        // mode: rw[int(118..140)] (range int)
        expect(props['mode']?.[Kind]).toBe('Integer');
        expect(props['mode']?.readOnly).toBeUndefined();
        expect(props['mode']?.minimum).toBe(118);
        expect(props['mode']?.maximum).toBe(140);
        expect(props['mode']?.['x-increment-step']).toBe(1);
        expect(result.data.mode).toBeUndefined();

        // levelA: rw[int]
        expect(props['levelA']?.[Kind]).toBe('Integer');
        expect(props['levelA']?.readOnly).toBeUndefined();
        expect(result.data.levelA).toBeUndefined();

        // levelB: rw[str(foo|bar|baz)] (string list → strProperty)
        expect(props['levelB']?.[Kind]).toBe('String');
        expect(props['levelB']?.readOnly).toBeUndefined();
        expect(result.data.levelB).toBeUndefined();

        // levelC: wo[str]
        expect(props['levelC']?.[Kind]).toBe('String');
        expect(props['levelC']?.writeOnly).toBe(true);
        expect(result.data.levelC).toBeUndefined();

        // levelD: rw[float]
        expect(props['levelD']?.[Kind]).toBe('Number');
        expect(props['levelD']?.readOnly).toBeUndefined();
        expect(result.data.levelD).toBeUndefined();

        // levelE: rw[int(1|2)] (integer list → listIntProperty with oneOf)
        expect(props['levelE']?.[Kind]).toBe('Integer');
        expect(props['levelE']?.readOnly).toBeUndefined();
        expect(props['levelE']?.oneOf).toStrictEqual([
            { const: 1, 'x-label': '1' },
            { const: 2, 'x-label': '2' },
        ]);
        expect(result.data.levelE).toBeUndefined();

    });

    it('throws an error if incomplete response is passed', async () => {

        // Arrange
        const response = "status;power:20";
        const protocol = new SlvCtrlProtocolV1();

        // Act
        const decodedResponse = protocol.decode(Buffer.from(response));

        // Assert
        expectToBeErrorDecodeResult(decodedResponse);
        expect(decodedResponse.error).toStrictEqual({
            type: 'invalid_frame',
            reason: 'Unexpected segment count (2)',
        });
    });

    it('parses a successful device attribute response with no attributes', async () => {

        // Arrange
        const response = "attributes;;status:ok";
        const protocol = new SlvCtrlProtocolV1();

        // Act
        const decodedResponse = protocol.decode(Buffer.from(response));

        expectToBeSuccessfulDecodeResult(decodedResponse);

        const result = protocol.getAttributes(decodedResponse.message.data);

        // Assert
        expect(TypeGuard.IsObject(result.schema)).toBe(true);

        if (!TypeGuard.IsObject(result.schema)) {
            return;
        }

        expect(Object.keys(result.schema.properties).length).toBe(0);
    });

    it('ignores empty attributes', async () => {

        // Arrange
        const response = "attributes;,;status:ok";
        const protocol = new SlvCtrlProtocolV1();

        // Act
        const decodedResponse = protocol.decode(Buffer.from(response));

        expectToBeSuccessfulDecodeResult(decodedResponse);

        const result = protocol.getAttributes(decodedResponse.message.data);

        // Assert
        expect(TypeGuard.IsObject(result.schema)).toBe(true);

        if (!TypeGuard.IsObject(result.schema)) {
            return;
        }

        expect(Object.keys(result.schema.properties).length).toBe(0);
    });

    it('ignores malformed attributes', async () => {

        // Arrange
        const response = "attributes;foo,bar:rw[bool];status:ok";
        const protocol = new SlvCtrlProtocolV1();

        // Act
        const decodedResult = protocol.decode(Buffer.from(response));

        expectToBeSuccessfulDecodeResult(decodedResult);

        const result = protocol.getAttributes(decodedResult.message.data);

        // Assert
        expect(TypeGuard.IsObject(result.schema)).toBe(true);

        if (!TypeGuard.IsObject(result.schema)) {
            return;
        }

        expect(Object.keys(result.schema.properties).length).toBe(1);

        expect(result.schema.properties['bar']?.[Kind]).toBe('Boolean');
        expect(result.schema.properties['bar']?.readOnly).toBeUndefined();
        expect(result.schema.properties['bar']?.writeOnly).toBeUndefined();
    });

    it('parses successful status response', async () => {

        // Arrange
        const response = "status;foo:20,bar:baz,hello:;status:ok";
        const protocol = new SlvCtrlProtocolV1();

        // Act
        const result = protocol.decode(Buffer.from(response));

        // Assert
        expectToBeSuccessfulDecodeResult(result);
        expect(result.message.data).toStrictEqual({
            foo: "20",
            bar: "baz",
            hello: "",
        });
    });

    it('parses empty status response', async () => {

        // Arrange
        const response = "status;;status:ok";
        const protocol = new SlvCtrlProtocolV1();

        // Act
        const result = protocol.decode(Buffer.from(response));

        // Assert
        expectToBeSuccessfulDecodeResult(result);
        expect(result.message.data).toStrictEqual({});
    });

    it('returns an error when the result segment has no status key', () => {
        const protocol = new SlvCtrlProtocolV1();

        const result = protocol.decode(Buffer.from('status;foo:bar;notastatus'));

        expectToBeErrorDecodeResult(result);
        expect(result.error).toStrictEqual({ type: 'invalid_frame', reason: 'Result segment is malformed' });
    });

    describe('isResponseMatchingMessage', () => {
        it('returns true when response command matches the encoded message', () => {
            const protocol = new SlvCtrlProtocolV1();
            const message = {
                message: { command: 'status', args: [] } satisfies SlvCtrlProtocolCommand,
                responseType: undefined,
            };
            const response = {
                command: 'status',
                data: {},
                result: { status: 'ok' as const },
            };

            expect(protocol.isResponseMatchingMessage(response, message)).toBe(true);
        });

        it('returns false when response command does not match the encoded message', () => {
            const protocol = new SlvCtrlProtocolV1();
            const message = {
                message: { command: 'status', args: [] } satisfies SlvCtrlProtocolCommand,
                responseType: undefined,
            };
            const response = {
                command: 'attributes',
                data: {},
                result: { status: 'ok' as const },
            };

            expect(protocol.isResponseMatchingMessage(response, message)).toBe(false);
        });
    });

    describe('getAttributes', () => {
        it('throws when an attribute has an unknown data type', () => {
            const protocol = new SlvCtrlProtocolV1();

            expect(() => protocol.getAttributes({ myAttr: 'rw[unknownType]' }))
                .toThrow('Unknown attribute data type: unknownType');
        });
    });
});
