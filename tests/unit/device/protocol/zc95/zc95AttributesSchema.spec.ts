import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { zc95AttributesSchema } from '../../../../../src/device/protocol/zc95/zc95AttributesSchema.js';
import { Zc95DevicePowerChannelIndex } from '../../../../../src/device/protocol/zc95/zc95Device.js';
import { registerAttributeSchemaKeywords } from '../../../../../src/device/attribute/attributeSchemaKeywords.js';
import JsonSchemaValidatorFactory from '../../../../../src/schemaValidation/JsonSchemaValidatorFactory.js';

describe('zc95AttributesSchema', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    registerAttributeSchemaKeywords(ajv);

    const jsonSchemaValidatorFactory = new JsonSchemaValidatorFactory(ajv);

    const minMaxMenuItem = {
        Id: 1,
        Title: 'Pulse Width',
        Group: 0,
        Type: 'MIN_MAX' as const,
        Default: 150,
        Min: 20,
        Max: 2000,
        IncrementStep: 10,
        UoM: 'us',
    };

    const multiChoiceMenuItem = {
        Id: 2,
        Title: 'Waveform',
        Group: 1,
        Type: 'MULTI_CHOICE' as const,
        Default: 0,
        Choices: [
            { Id: 0, Name: 'Sine' },
            { Id: 1, Name: 'Square' },
        ],
    };

    const buildSchema = () => zc95AttributesSchema({
        patterns: [
            { Type: 'PatternDetail', Id: 0, Name: 'Waves' },
            { Type: 'PatternDetail', Id: 1, Name: 'Pulse' },
        ],
        activePatternMenuItems: [minMaxMenuItem, multiChoiceMenuItem],
        powerChannels: [
            { channel: Zc95DevicePowerChannelIndex.One, maxOutputPower: 85 },
            { channel: Zc95DevicePowerChannelIndex.Two, maxOutputPower: 85 },
            { channel: Zc95DevicePowerChannelIndex.Three, maxOutputPower: 85 },
            { channel: Zc95DevicePowerChannelIndex.Four, maxOutputPower: 85 },
        ],
    });

    it('maps a MIN_MAX menu item to a range-shaped property with x-uom mapped and x-increment-step', () => {
        const schema = buildSchema();

        expect(schema.properties.patternAttribute1).toMatchObject({
            type: 'integer',
            'x-label': 'Pulse Width',
            'x-group': 0,
            'x-uom': 'µs',
            minimum: 20,
            maximum: 2000,
            'x-increment-step': 10,
            default: 150,
        });
    });

    it('maps a MULTI_CHOICE menu item to a labeled-enum shaped property', () => {
        const schema = buildSchema();

        expect(schema.properties.patternAttribute2).toMatchObject({
            type: 'integer',
            'x-label': 'Waveform',
            'x-group': 1,
            default: 0,
            oneOf: [
                { const: 0, 'x-label': 'Sine' },
                { const: 1, 'x-label': 'Square' },
            ],
        });
    });

    it('maps the pattern list to the activePattern choices', () => {
        const schema = buildSchema();

        expect(schema.properties.activePattern).toMatchObject({
            oneOf: [
                { const: 0, 'x-label': 'Waves' },
                { const: 1, 'x-label': 'Pulse' },
            ],
        });
    });

    it('maps power channels to bounded range properties', () => {
        const schema = buildSchema();

        expect(schema.properties.powerChannel1).toMatchObject({ type: 'integer', minimum: 0, maximum: 85 });
        expect(schema.properties.powerChannel4).toMatchObject({ type: 'integer', minimum: 0, maximum: 85 });
    });

    it('validates a value object that satisfies all bounds and choices', () => {
        const validator = jsonSchemaValidatorFactory.create(buildSchema());

        const isValid = validator.validate({
            activePattern: 1,
            patternStarted: true,
            powerChannel1: 40,
            powerChannel2: 0,
            powerChannel3: 0,
            powerChannel4: 0,
            patternAttribute1: 150,
            patternAttribute2: 1,
        });

        expect(isValid).toBe(true);
    });

    it('rejects a value exceeding the range maximum', () => {
        const validator = jsonSchemaValidatorFactory.create(buildSchema());

        const isValid = validator.validate({
            activePattern: 0,
            patternStarted: false,
            powerChannel1: 999,
            powerChannel2: 0,
            powerChannel3: 0,
            powerChannel4: 0,
            patternAttribute1: 150,
            patternAttribute2: 0,
        });

        expect(isValid).toBe(false);
    });

    it('rejects a value that is not one of the labeled choices', () => {
        const validator = jsonSchemaValidatorFactory.create(buildSchema());

        const isValid = validator.validate({
            activePattern: 0,
            patternStarted: false,
            powerChannel1: 0,
            powerChannel2: 0,
            powerChannel3: 0,
            powerChannel4: 0,
            patternAttribute1: 150,
            patternAttribute2: 7,
        });

        expect(isValid).toBe(false);
    });

    it('rejects unknown properties', () => {
        const validator = jsonSchemaValidatorFactory.create(buildSchema());

        const isValid = validator.validate({
            activePattern: 0,
            patternStarted: false,
            powerChannel1: 0,
            powerChannel2: 0,
            powerChannel3: 0,
            powerChannel4: 0,
            patternAttribute1: 150,
            patternAttribute2: 0,
            somethingUnexpected: true,
        });

        expect(isValid).toBe(false);
    });

    it('throws under ajv strict mode if the x-* annotation keywords are not registered', () => {
        const strictAjv = new Ajv2020({ allErrors: true, strict: true });
        const strictFactory = new JsonSchemaValidatorFactory(strictAjv);

        expect(() => strictFactory.create(buildSchema())).toThrow();
    });
});
