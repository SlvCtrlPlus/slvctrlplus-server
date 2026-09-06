import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { registerAttributeSchemaKeywords } from '../../../../src/device/attribute/attributeSchemaKeywords.js';

describe('registerAttributeSchemaKeywords', () => {
    const buildValidator = (): ((data: unknown) => boolean) => {
        const ajv = new Ajv2020({ allErrors: true, strict: true });
        registerAttributeSchemaKeywords(ajv);

        return ajv.compile({
            'type': 'integer',
            'minimum': 12,
            'maximum': 20,
            'x-increment-step': 3,
        });
    };

    it.each([12, 15, 18])('accepts %i as it lies on the step grid anchored at minimum', value => {
        expect(buildValidator()(value)).toBe(true);
    });

    it.each([13, 14, 16, 17, 19, 20])('rejects %i as it does not lie on the step grid', value => {
        expect(buildValidator()(value)).toBe(false);
    });

    it('rejects a value below minimum regardless of step alignment', () => {
        expect(buildValidator()(9)).toBe(false);
    });

    it('rejects a value above maximum even if step-aligned', () => {
        const ajv = new Ajv2020({ allErrors: true, strict: true });
        registerAttributeSchemaKeywords(ajv);

        const validate = ajv.compile({
            'type': 'integer',
            'minimum': 12,
            'maximum': 20,
            'x-increment-step': 3,
        });

        // 21 is step-aligned (12, 15, 18, 21, ...) but exceeds maximum
        expect(validate(21)).toBe(false);
    });

    it('anchors the step grid at 0 when no minimum is declared', () => {
        const ajv = new Ajv2020({ allErrors: true, strict: true });
        registerAttributeSchemaKeywords(ajv);

        const validate = ajv.compile({ 'type': 'integer', 'x-increment-step': 5 });

        expect(validate(10)).toBe(true);
        expect(validate(12)).toBe(false);
    });

    it('treats x-label, x-uom and x-group as pure annotations that never fail validation', () => {
        const ajv = new Ajv2020({ allErrors: true, strict: true });
        registerAttributeSchemaKeywords(ajv);

        const validate = ajv.compile({
            'type': 'integer',
            'x-label': 'Channel 1',
            'x-uom': '%',
            'x-group': 0,
        });

        expect(validate(42)).toBe(true);
    });
});
