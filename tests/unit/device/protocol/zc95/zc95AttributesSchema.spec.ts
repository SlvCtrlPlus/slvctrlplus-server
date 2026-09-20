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

    // Schema is Type.Union([stopped, started]) — stopped at index 0, started at index 1.
    const getStoppedBranch = (schema: ReturnType<typeof buildSchema>) => schema.anyOf[0];
    const getStartedBranch = (schema: ReturnType<typeof buildSchema>) => schema.anyOf[1];

    it('produces a union schema with stopped and started branches', () => {
        const schema = buildSchema();

        expect(schema.anyOf).toHaveLength(2);
        expect(getStoppedBranch(schema)).toBeDefined();
        expect(getStartedBranch(schema)).toBeDefined();
    });

    it('maps a MIN_MAX menu item to a range-shaped property nested in patternAttributes', () => {
        const schema = buildSchema();
        const started = getStartedBranch(schema);

        expect(started.properties.patternAttributes.properties[1]).toMatchObject({
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

    it('maps a MULTI_CHOICE menu item to a labeled-enum shaped property nested in patternAttributes', () => {
        const schema = buildSchema();
        const started = getStartedBranch(schema);

        expect(started.properties.patternAttributes.properties[2]).toMatchObject({
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

    it('maps the pattern list to the activePattern choices on both branches', () => {
        const schema = buildSchema();
        const stopped = getStoppedBranch(schema);
        const started = getStartedBranch(schema);

        const expectedChoices = {
            oneOf: [
                { const: 0, 'x-label': 'Waves' },
                { const: 1, 'x-label': 'Pulse' },
            ],
        };

        expect(stopped.properties.activePattern).toMatchObject(expectedChoices);
        expect(started.properties.activePattern).toMatchObject(expectedChoices);
    });

    it('maps power channels to bounded range properties nested in powerChannels', () => {
        const schema = buildSchema();
        const started = getStartedBranch(schema);

        expect(started.properties.powerChannels.properties[1]).toMatchObject({ type: 'integer', minimum: 0, maximum: 85 });
        expect(started.properties.powerChannels.properties[4]).toMatchObject({ type: 'integer', minimum: 0, maximum: 85 });
    });

    it('validates a started value object that satisfies all bounds and choices', () => {
        const validator = jsonSchemaValidatorFactory.create(buildSchema());

        const isValid = validator.validate({
            activePattern: 1,
            patternStarted: true,
            powerChannels: { 1: 40, 2: 0, 3: 0, 4: 0 },
            patternAttributes: { 1: 150, 2: 1 },
        });

        expect(isValid).toBe(true);
    });

    it('validates a stopped value object', () => {
        const validator = jsonSchemaValidatorFactory.create(buildSchema());

        const isValid = validator.validate({
            activePattern: 0,
            patternStarted: false,
        });

        expect(isValid).toBe(true);
    });

    it('rejects a value exceeding the range maximum', () => {
        const validator = jsonSchemaValidatorFactory.create(buildSchema());

        const isValid = validator.validate({
            activePattern: 0,
            patternStarted: true,
            powerChannels: { 1: 999, 2: 0, 3: 0, 4: 0 },
            patternAttributes: { 1: 150, 2: 0 },
        });

        expect(isValid).toBe(false);
    });

    it('rejects a value that is not one of the labeled choices', () => {
        const validator = jsonSchemaValidatorFactory.create(buildSchema());

        const isValid = validator.validate({
            activePattern: 0,
            patternStarted: true,
            powerChannels: { 1: 0, 2: 0, 3: 0, 4: 0 },
            patternAttributes: { 1: 150, 2: 7 },
        });

        expect(isValid).toBe(false);
    });

    it('rejects unknown properties in the top-level object', () => {
        const validator = jsonSchemaValidatorFactory.create(buildSchema());

        const isValid = validator.validate({
            activePattern: 0,
            patternStarted: false,
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
