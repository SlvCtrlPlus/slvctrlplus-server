import {describe, it, expect} from "vitest";
import SlvCtrlProtocolLegacy from "../../../../../src/device/protocol/slvCtrlPlus/slvCtrlProtocolLegacy.js";
import {DeviceAttributeModifier} from "../../../../../src/device/attribute/deviceAttribute.js";
import BoolDeviceAttribute from "../../../../../src/device/attribute/boolDeviceAttribute.js";
import IntRangeDeviceAttribute from "../../../../../src/device/attribute/intRangeDeviceAttribute.js";
import IntDeviceAttribute from "../../../../../src/device/attribute/intDeviceAttribute.js";
import ListDeviceAttribute from "../../../../../src/device/attribute/listDeviceAttribute.js";
import StrDeviceAttribute from "../../../../../src/device/attribute/strDeviceAttribute.js";
import FloatDeviceAttribute from "../../../../../src/device/attribute/floatDeviceAttribute.js";
import { expectToBeSuccessfulDecodeResult } from '../../../helper/protocol.js';
import { SlvCtrlProtocolCommand } from '../../../../../src/device/protocol/slvCtrlPlus/slvCtrlProtocol.js';

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
    ])('encodes command to $encodedCommand', async ({ command, encodedCommand }) => {
        // Arrange
        const protocol = new SlvCtrlProtocolLegacy();

        // Act
        const result = protocol.encode(command)

        // Assert
        expect(result.toString('utf-8')).toStrictEqual(encodedCommand + '\n');
    });

    it('it parses a successful device attribute response', async () => {

        // Arrange
        const response = "attributes;connected:ro[bool],adc:rw[bool],mode:rw[118-140],levelA:rw[int],levelB:rw[foo|bar|baz],levelC:wo[str],levelD:rw[float]";

        const protocol = new SlvCtrlProtocolLegacy();

        // Act
        const resultTemp = protocol.decode(Buffer.from(response));

        expectToBeSuccessfulDecodeResult(resultTemp);

        const result = protocol.getAttributes(resultTemp.message.data);

        // Assert
        expect(Object.keys(result).length).toBe(7);

        expect(result.connected).toBeInstanceOf(BoolDeviceAttribute);
        expect(result.connected.name).toBe('connected');
        expect(result.connected.modifier).toBe(DeviceAttributeModifier.readOnly);

        expect(result.adc).toBeInstanceOf(BoolDeviceAttribute);
        expect(result.adc.name).toBe('adc');
        expect(result.adc.modifier).toBe(DeviceAttributeModifier.readWrite);

        expect(result.mode).toBeInstanceOf(IntRangeDeviceAttribute);
        expect(result.mode.name).toBe('mode');
        expect(result.mode.modifier).toBe(DeviceAttributeModifier.readWrite);
        expect((result.mode as IntRangeDeviceAttribute).min).toBe(118);
        expect((result.mode as IntRangeDeviceAttribute).max).toBe(140);

        expect(result.levelA).toBeInstanceOf(IntDeviceAttribute);
        expect(result.levelA.name).toBe('levelA');
        expect(result.levelA.modifier).toBe(DeviceAttributeModifier.readWrite);

        expect(result.levelB).toBeInstanceOf(ListDeviceAttribute);
        expect(result.levelB.name).toBe('levelB');
        expect(result.levelB.modifier).toBe(DeviceAttributeModifier.readWrite);
        expect((result.levelB as ListDeviceAttribute<string, string>).values)
            .toStrictEqual([{ key: 'foo', value: 'foo'}, { key: 'bar', value: 'bar' }, { key: 'baz', value: 'baz'}]);

        expect(result.levelC).toBeInstanceOf(StrDeviceAttribute);
        expect(result.levelC.name).toBe('levelC');
        expect(result.levelC.modifier).toBe(DeviceAttributeModifier.writeOnly);

        expect(result.levelD).toBeInstanceOf(FloatDeviceAttribute);
        expect(result.levelD.name).toBe('levelD');
        expect(result.levelD.modifier).toBe(DeviceAttributeModifier.readWrite);
    });

    it('it parses a successful device attribute response with no attributes', async () => {

        // Arrange
        const response = "attributes;";

        const protocol = new SlvCtrlProtocolLegacy();

        // Act
        const result = protocol.decode(Buffer.from(response));

        expectToBeSuccessfulDecodeResult(result);

        // Assert
        expect(Object.keys(result.message.data).length).toBe(0);
    });

    it('it ignores empty attributes', async () => {

        // Arrange
        const response = "attributes;,";

        const protocol = new SlvCtrlProtocolLegacy();

        // Act
        const result = protocol.decode(Buffer.from(response));

        expectToBeSuccessfulDecodeResult(result);

        // Assert
        expect(Object.keys(result.message.data).length).toBe(0);
    });

    it('it ignores malformed attributes', async () => {

        // Arrange
        const response = "attributes;foo,bar:rw[bool]";

        const protocol = new SlvCtrlProtocolLegacy();

        // Act
        const resultTemp = protocol.decode(Buffer.from(response));

        expectToBeSuccessfulDecodeResult(resultTemp);

        const result = protocol.getAttributes(resultTemp.message.data);

        // Assert
        expect(Object.keys(result).length).toBe(1);

        expect(result.bar).toBeInstanceOf(BoolDeviceAttribute);
        expect(result.bar.name).toBe('bar');
        expect(result.bar.modifier).toBe(DeviceAttributeModifier.readWrite);
    });

    it('it parses successful status response', async () => {

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

    it('it parses empty status response', async () => {

        // Arrange
        const response = "status;";

        const protocol = new SlvCtrlProtocolLegacy();

        // Act
        const result = protocol.decode(Buffer.from(response));

        expectToBeSuccessfulDecodeResult(result);

        // Assert
        expect(result.message.data).toStrictEqual({});
    });
});
