import SlvCtrlPlusMessageParser from "../../../../../src/device/protocol/slvCtrlPlus/slvCtrlPlusMessageParser.js";
import {GenericDeviceAttributeModifier} from "../../../../../src/device/attribute/genericDeviceAttribute.js";
import BoolGenericDeviceAttribute from "../../../../../src/device/attribute/boolGenericDeviceAttribute.js";
import RangeGenericDeviceAttribute from "../../../../../src/device/attribute/rangeGenericDeviceAttribute.js";
import IntGenericDeviceAttribute from "../../../../../src/device/attribute/intGenericDeviceAttribute.js";
import ListGenericDeviceAttribute from "../../../../../src/device/attribute/listGenericDeviceAttribute.js";
import StrGenericDeviceAttribute from "../../../../../src/device/attribute/strGenericDeviceAttribute.js";
import FloatGenericDeviceAttribute from "../../../../../src/device/attribute/floatGenericDeviceAttribute.js";

describe('SlvCtrlPlusMessageParser', () => {

    it('it parses a successful device attribute response', async () => {

        // Arrange
        const response = "attributes;connected:ro[bool],adc:rw[bool],mode:rw[118-140],levelA:rw[int],levelB:rw[foo|bar|baz],levelC:wo[str],levelD:rw[float]";

        // Act
        const result = SlvCtrlPlusMessageParser.parseDeviceAttributes(response);

        // Assert
        expect(result.length).toBe(7);

        expect(result[0]).toBeInstanceOf(BoolGenericDeviceAttribute);
        expect(result[0].name).toBe('connected');
        expect(result[0].modifier).toBe(GenericDeviceAttributeModifier.readOnly);

        expect(result[1]).toBeInstanceOf(BoolGenericDeviceAttribute);
        expect(result[1].name).toBe('adc');
        expect(result[1].modifier).toBe(GenericDeviceAttributeModifier.readWrite);

        expect(result[2]).toBeInstanceOf(RangeGenericDeviceAttribute);
        expect(result[2].name).toBe('mode');
        expect(result[2].modifier).toBe(GenericDeviceAttributeModifier.readWrite);
        expect((result[2] as RangeGenericDeviceAttribute).min).toBe(118);
        expect((result[2] as RangeGenericDeviceAttribute).max).toBe(140);

        expect(result[3]).toBeInstanceOf(IntGenericDeviceAttribute);
        expect(result[3].name).toBe('levelA');
        expect(result[3].modifier).toBe(GenericDeviceAttributeModifier.readWrite);

        expect(result[4]).toBeInstanceOf(ListGenericDeviceAttribute);
        expect(result[4].name).toBe('levelB');
        expect(result[4].modifier).toBe(GenericDeviceAttributeModifier.readWrite);
        expect((result[4] as ListGenericDeviceAttribute).values).toStrictEqual(['foo', 'bar', 'baz']);

        expect(result[5]).toBeInstanceOf(StrGenericDeviceAttribute);
        expect(result[5].name).toBe('levelC');
        expect(result[5].modifier).toBe(GenericDeviceAttributeModifier.writeOnly);

        expect(result[6]).toBeInstanceOf(FloatGenericDeviceAttribute);
        expect(result[6].name).toBe('levelD');
        expect(result[6].modifier).toBe(GenericDeviceAttributeModifier.readWrite);
    });

    it('it throws an error if wrong response is passed', async () => {

        // Arrange
        const response = "status;power:20";

        // Act
        const result = () => SlvCtrlPlusMessageParser.parseDeviceAttributes(response);

        // Assert
        expect(result).toThrow(`Invalid response format for parsing attributes: ${response}`);
    });

    it('it parses a successful device attribute response with no attributes', async () => {

        // Arrange
        const response = "attributes;";

        // Act
        const result = SlvCtrlPlusMessageParser.parseDeviceAttributes(response);

        // Assert
        expect(result.length).toBe(0);
    });

    it('it ignores empty attributes', async () => {

        // Arrange
        const response = "attributes;,";

        // Act
        const result = SlvCtrlPlusMessageParser.parseDeviceAttributes(response);

        // Assert
        expect(result.length).toBe(0);
    });

    it('it ignores malformed attributes', async () => {

        // Arrange
        const response = "attributes;foo,bar:rw[bool]";

        // Act
        const result = SlvCtrlPlusMessageParser.parseDeviceAttributes(response);

        // Assert
        expect(result.length).toBe(1);

        expect(result[0]).toBeInstanceOf(BoolGenericDeviceAttribute);
        expect(result[0].name).toBe('bar');
        expect(result[0].modifier).toBe(GenericDeviceAttributeModifier.readWrite);
    });

    it('it parses successful status response', async () => {

        // Arrange
        const response = "status;foo:20,bar:baz,hello:";

        // Act
        const result = SlvCtrlPlusMessageParser.parseStatus(response);

        // Assert
        expect(result).toStrictEqual({
            foo: "20",
            bar: "baz",
            hello: "",
        });
    });

    it('it parses empty status response', async () => {

        // Arrange
        const response = "status;";

        // Act
        const result = SlvCtrlPlusMessageParser.parseStatus(response);

        // Assert
        expect(result).toStrictEqual({});
    });
});
