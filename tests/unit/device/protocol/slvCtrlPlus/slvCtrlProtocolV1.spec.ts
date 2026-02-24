import {describe, it, expect} from "vitest";
import {DeviceAttributeModifier} from "../../../../../src/device/attribute/deviceAttribute.js";
import BoolDeviceAttribute from "../../../../../src/device/attribute/boolDeviceAttribute.js";
import IntRangeDeviceAttribute from "../../../../../src/device/attribute/intRangeDeviceAttribute.js";
import IntDeviceAttribute from "../../../../../src/device/attribute/intDeviceAttribute.js";
import ListDeviceAttribute from "../../../../../src/device/attribute/listDeviceAttribute.js";
import StrDeviceAttribute from "../../../../../src/device/attribute/strDeviceAttribute.js";
import FloatDeviceAttribute from "../../../../../src/device/attribute/floatDeviceAttribute.js";
import SlvCtrlProtocolV1 from '../../../../../src/device/protocol/slvCtrlPlus/slvCtrlProtocolV1.js';
import { Int } from '../../../../../src/util/numbers.js';
import { expectToBeErrorDecodeResult, expectToBeSuccessfulDecodeResult } from '../../../helper/protocol.js';

describe('slvCtrlProtocolV1', () => {

    it('it parses a successful device attribute response', async () => {

        // Arrange
        const response = "attributes;connected:ro[bool],adc:rw[bool],mode:rw[int(118..140)],levelA:rw[int],levelB:rw[str(foo|bar|baz)],levelC:wo[str],levelD:rw[float],levelE:rw[int(1|2)];status:ok";

        const protocol = new SlvCtrlProtocolV1();

        // Act
        const decodedResponse = protocol.decode(response);

        expectToBeSuccessfulDecodeResult(decodedResponse);

        const result = protocol.getAttributes(decodedResponse.message.data);

        // Assert
        expect(Object.keys(result).length).toBe(8);

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

        expect(result.levelE).toBeInstanceOf(ListDeviceAttribute);
        expect(result.levelE.name).toBe('levelE');
        expect(result.levelE.modifier).toBe(DeviceAttributeModifier.readWrite);
        expect((result.levelE as ListDeviceAttribute<Int, Int>).values)
            .toStrictEqual([{ key: 1, value: 1}, { key: 2, value: 2 }]);

    });

    it('it throws an error if incomplete response is passed', async () => {

        // Arrange
        const response = "status;power:20";
        const protocol = new SlvCtrlProtocolV1();

        // Act
        const decodedResponse = protocol.decode(response);

        // Assert
        expectToBeErrorDecodeResult(decodedResponse);
        expect(decodedResponse.error).toStrictEqual({
            type: 'invalid_frame',
            reason: 'Unexpected segment count (2)',
        });
    });

    it('it parses a successful device attribute response with no attributes', async () => {

        // Arrange
        const response = "attributes;;status:ok";
        const protocol = new SlvCtrlProtocolV1();

        // Act
        const decodedResponse = protocol.decode(response);

        expectToBeSuccessfulDecodeResult(decodedResponse);

        const result = protocol.getAttributes(decodedResponse.message.data);

        // Assert
        expect(Object.keys(result).length).toBe(0);
    });

    it('it ignores empty attributes', async () => {

        // Arrange
        const response = "attributes;,;status:ok";
        const protocol = new SlvCtrlProtocolV1();

        // Act
        const decodedResponse = protocol.decode(response);

        expectToBeSuccessfulDecodeResult(decodedResponse);

        const result = protocol.getAttributes(decodedResponse.message.data);

        // Assert
        expect(Object.keys(result).length).toBe(0);
    });

    it('it ignores malformed attributes', async () => {

        // Arrange
        const response = "attributes;foo,bar:rw[bool];status:ok";
        const protocol = new SlvCtrlProtocolV1();

        // Act
        const decodedResult = protocol.decode(response);

        expectToBeSuccessfulDecodeResult(decodedResult);

        const result = protocol.getAttributes(decodedResult.message.data);

        // Assert
        expect(Object.keys(result).length).toBe(1);

        expect(result.bar).toBeInstanceOf(BoolDeviceAttribute);
        expect(result.bar.name).toBe('bar');
        expect(result.bar.modifier).toBe(DeviceAttributeModifier.readWrite);
    });

    it('it parses successful status response', async () => {

        // Arrange
        const response = "status;foo:20,bar:baz,hello:;status:ok";
        const protocol = new SlvCtrlProtocolV1();

        // Act
        const result = protocol.decode(response);

        // Assert
        expectToBeSuccessfulDecodeResult(result);
        expect(result.message.data).toStrictEqual({
            foo: "20",
            bar: "baz",
            hello: "",
        });
    });

    it('it parses empty status response', async () => {

        // Arrange
        const response = "status;;status:ok";
        const protocol = new SlvCtrlProtocolV1();

        // Act
        const result = protocol.decode(response);

        // Assert
        expectToBeSuccessfulDecodeResult(result);
        expect(result.message.data).toStrictEqual({});
    });
});
