import {describe, it, expect} from "vitest";
import SlvCtrlProtocolLegacy from "../../../../../src/device/protocol/slvCtrlPlus/slvCtrlProtocolLegacy.js";
import { Kind, TypeGuard } from '@sinclair/typebox';
import { expectToBeErrorDecodeResult, expectToBeSuccessfulDecodeResult } from '../../../helper/protocol.js';
import { SlvCtrlProtocolCommand, SlvCtrlProtocolResponse } from '../../../../../src/device/protocol/slvCtrlPlus/slvCtrlProtocol.js';

describe('slvCtrlProtocolLegacy', () => {

    it.each([
        {
            command: { command: 'set', args: ['attrName', 42] } satisfies SlvCtrlProtocolCommand,
            encodedCommand: 'set-attrName 42'
        },
        {
            command: { command: 'set', args: ['attrName', false] } satisfies SlvCtrlProtocolCommand,
            encodedCommand: 'set-attrName 0'
        },
        {
            command: { command: 'set', args: ['attrName', true] } satisfies SlvCtrlProtocolCommand,
            encodedCommand: 'set-attrName 1'
        },
        {
            command: { command: 'set', args: ['attrName', 'foo'] } satisfies SlvCtrlProtocolCommand,
            encodedCommand: 'set-attrName foo'
        },
        {
            command: { command: 'otherCommand', args: ['foo', 'bar'] } satisfies SlvCtrlProtocolCommand,
            encodedCommand: 'otherCommand foo bar'
        },
        {
            command: { command: 'introduce', args: [] } satisfies SlvCtrlProtocolCommand,
            encodedCommand: 'introduce'
        },
    ])('encodes command to $encodedCommand', async ({ command, encodedCommand }) => {
        // Arrange
        const protocol = new SlvCtrlProtocolLegacy();

        // Act
        const result = protocol.encode(command)

        // Assert
        expect(result.toString('utf-8')).toStrictEqual(encodedCommand);
    });

    it('parses a successful device attribute response', async () => {

        // Arrange
        const response = "attributes;connected:ro[bool],adc:rw[bool],mode:rw[118-140],levelA:rw[int],levelB:rw[foo|bar|baz],levelC:wo[str],levelD:rw[float]";

        const protocol = new SlvCtrlProtocolLegacy();

        // Act
        const resultTemp = protocol.decode(Buffer.from(response));

        expectToBeSuccessfulDecodeResult(resultTemp);

        const result = protocol.getAttributes(resultTemp.message.data);

        // Assert
        expect(TypeGuard.IsObject(result.schema)).toBe(true);

        if (!TypeGuard.IsObject(result.schema)) {
            return;
        }

        const { properties: props } = result.schema;
        expect(Object.keys(props).length).toBe(7);

        // connected: ro[bool]
        expect(props['connected']?.[Kind]).toBe('Boolean');
        expect(props['connected']?.readOnly).toBe(true);
        expect(result.data.connected).toBeUndefined();

        // adc: rw[bool]
        expect(props['adc']?.[Kind]).toBe('Boolean');
        expect(props['adc']?.readOnly).toBeUndefined();
        expect(props['adc']?.writeOnly).toBeUndefined();
        expect(result.data.adc).toBeUndefined();

        // mode: rw[118-140] (range int)
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

        // levelB: rw[foo|bar|baz] (legacy string list → strProperty)
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
    });

    it('parses a successful device attribute response with no attributes', async () => {

        // Arrange
        const response = "attributes;";

        const protocol = new SlvCtrlProtocolLegacy();

        // Act
        const result = protocol.decode(Buffer.from(response));

        expectToBeSuccessfulDecodeResult(result);

        // Assert
        expect(Object.keys(result.message.data).length).toBe(0);
    });

    it('ignores empty attributes', async () => {

        // Arrange
        const response = "attributes;,";

        const protocol = new SlvCtrlProtocolLegacy();

        // Act
        const result = protocol.decode(Buffer.from(response));

        expectToBeSuccessfulDecodeResult(result);

        // Assert
        expect(Object.keys(result.message.data).length).toBe(0);
    });

    it('ignores malformed attributes', async () => {

        // Arrange
        const response = "attributes;foo,bar:rw[bool]";

        const protocol = new SlvCtrlProtocolLegacy();

        // Act
        const resultTemp = protocol.decode(Buffer.from(response));

        expectToBeSuccessfulDecodeResult(resultTemp);

        const result = protocol.getAttributes(resultTemp.message.data);

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
        const response = "status;foo:20,bar:baz,hello:";

        const protocol = new SlvCtrlProtocolLegacy();

        // Act
        const result = protocol.decode(Buffer.from(response));

        expectToBeSuccessfulDecodeResult(result);

        // Assert
        expect(result.message.data).toStrictEqual({
            foo: "20",
            bar: "baz",
            hello: "",
        });
    });

    it('parses empty status response', async () => {

        // Arrange
        const response = "status;";

        const protocol = new SlvCtrlProtocolLegacy();

        // Act
        const result = protocol.decode(Buffer.from(response));

        expectToBeSuccessfulDecodeResult(result);

        // Assert
        expect(result.message.data).toStrictEqual({});
    });

    it('returns an error when a mandatory segment is missing', () => {
        const protocol = new SlvCtrlProtocolLegacy();

        const result = protocol.decode(Buffer.from('onlyCommandNoSemicolon'));

        expectToBeErrorDecodeResult(result);
        expect(result.error).toStrictEqual({ type: 'invalid_frame', reason: 'Mandatory segment missing' });
    });

    it('parses set attribute response with value key', () => {
        const protocol = new SlvCtrlProtocolLegacy();

        const result = protocol.decode(Buffer.from('set-mode;42'));

        expectToBeSuccessfulDecodeResult(result);
        expect(result.message.command).toStrictEqual('set-mode');
        expect(result.message.data).toStrictEqual({ value: '42' });
    });

    it('parses introduce response with type, fw, and protocol keys', () => {
        const protocol = new SlvCtrlProtocolLegacy();

        const result = protocol.decode(Buffer.from('introduce;myDevice,1000,2'));

        expectToBeSuccessfulDecodeResult(result);
        expect(result.message.command).toStrictEqual('introduce');
        expect(result.message.data).toStrictEqual({ type: 'myDevice', fw: '1000', protocol: '2' });
    });

    it('parses the result section for error responses', () => {
        const protocol = new SlvCtrlProtocolLegacy();

        const result = protocol.decode(Buffer.from('set-mode;42;error,Not found'));

        expectToBeSuccessfulDecodeResult(result);
        expect(result.message.result).toStrictEqual({ status: 'error', reason: 'Not found' });
    });

    describe('isResponseMatchingMessage', () => {
        it('returns true when response command matches the encoded message', () => {
            const protocol = new SlvCtrlProtocolLegacy();
            const message = {
                message: { command: 'status', args: [] } satisfies SlvCtrlProtocolCommand,
                responseType: undefined,
            };
            const response: SlvCtrlProtocolResponse = {
                command: 'status',
                data: {},
                result: { status: 'ok' },
            };

            expect(protocol.isResponseMatchingMessage(response, message)).toBe(true);
        });

        it('returns false when response command does not match the encoded message', () => {
            const protocol = new SlvCtrlProtocolLegacy();
            const message = {
                message: { command: 'status', args: [] } satisfies SlvCtrlProtocolCommand,
                responseType: undefined,
            };
            const response: SlvCtrlProtocolResponse = {
                command: 'attributes',
                data: {},
                result: { status: 'ok' },
            };

            expect(protocol.isResponseMatchingMessage(response, message)).toBe(false);
        });
    });
});
