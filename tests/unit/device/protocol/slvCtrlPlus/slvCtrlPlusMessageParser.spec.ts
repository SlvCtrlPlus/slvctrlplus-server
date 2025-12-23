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
        expect(Object.keys(result).length).toBe(7);

        expect(result.connected).toBeInstanceOf(BoolGenericDeviceAttribute);
        expect(result.connected.name).toBe('connected');
        expect(result.connected.modifier).toBe(GenericDeviceAttributeModifier.readOnly);

        expect(result.adc).toBeInstanceOf(BoolGenericDeviceAttribute);
        expect(result.adc.name).toBe('adc');
        expect(result.adc.modifier).toBe(GenericDeviceAttributeModifier.readWrite);

        expect(result.mode).toBeInstanceOf(RangeGenericDeviceAttribute);
        expect(result.mode.name).toBe('mode');
        expect(result.mode.modifier).toBe(GenericDeviceAttributeModifier.readWrite);
        expect((result.mode as RangeGenericDeviceAttribute).min).toBe(118);
        expect((result.mode as RangeGenericDeviceAttribute).max).toBe(140);

        expect(result.levelA).toBeInstanceOf(IntGenericDeviceAttribute);
        expect(result.levelA.name).toBe('levelA');
        expect(result.levelA.modifier).toBe(GenericDeviceAttributeModifier.readWrite);

        expect(result.levelB).toBeInstanceOf(ListGenericDeviceAttribute);
        expect(result.levelB.name).toBe('levelB');
        expect(result.levelB.modifier).toBe(GenericDeviceAttributeModifier.readWrite);
        expect((result.levelB as ListGenericDeviceAttribute<string, string>).values)
            .toStrictEqual(new Map([['foo', 'foo'], ['bar', 'bar'], ['baz', 'baz']]));

        expect(result.levelC).toBeInstanceOf(StrGenericDeviceAttribute);
        expect(result.levelC.name).toBe('levelC');
        expect(result.levelC.modifier).toBe(GenericDeviceAttributeModifier.writeOnly);

        expect(result.levelD).toBeInstanceOf(FloatGenericDeviceAttribute);
        expect(result.levelD.name).toBe('levelD');
        expect(result.levelD.modifier).toBe(GenericDeviceAttributeModifier.readWrite);
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
        expect(Object.keys(result).length).toBe(0);
    });

    it('it ignores empty attributes', async () => {

        // Arrange
        const response = "attributes;,";

        // Act
        const result = SlvCtrlPlusMessageParser.parseDeviceAttributes(response);

        // Assert
        expect(Object.keys(result).length).toBe(0);
    });

    it('it ignores malformed attributes', async () => {

        // Arrange
        const response = "attributes;foo,bar:rw[bool]";

        // Act
        const result = SlvCtrlPlusMessageParser.parseDeviceAttributes(response);

        // Assert
        expect(Object.keys(result).length).toBe(1);

        expect(result.bar).toBeInstanceOf(BoolGenericDeviceAttribute);
        expect(result.bar.name).toBe('bar');
        expect(result.bar.modifier).toBe(GenericDeviceAttributeModifier.readWrite);
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
