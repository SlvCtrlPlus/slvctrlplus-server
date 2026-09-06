import type { Ajv, AnySchemaObject } from 'ajv';

/**
 * Pure annotation keywords used to describe device attributes within a JSON Schema document.
 * These carry no validation semantics (ajv treats them as always-valid), they exist purely to
 * enrich the schema with information a client needs to render a form (label, unit, grouping).
 */
const attributeAnnotationKeywords = ['x-label', 'x-uom', 'x-group'] as const;

const floatingPointTolerance = 1e-9;

/**
 * Validates that a numeric value lies on the step grid anchored at the property's `minimum`
 * (or at 0 if no `minimum` is declared), e.g. for `minimum: 12, x-increment-step: 3` the values
 * 12, 15, 18, ... are valid, but 13, 14, 20 are not. `maximum`/`minimum` themselves are still
 * enforced by their own standard keywords.
 */
const validateIncrementStep = (step: number, value: number, parentSchema?: AnySchemaObject): boolean => {
    const anchor: unknown = parentSchema?.minimum;
    const start = 'number' === typeof anchor ? anchor : 0;

    if (0 === step) {
        return value === start;
    }

    const steps = (value - start) / step;

    return Math.abs(steps - Math.round(steps)) < floatingPointTolerance;
};

/**
 * Registers the `x-*` attribute annotation keywords, plus the validating `x-increment-step`
 * keyword, on the given ajv instance so schemas using them validate under `strict: true`
 * (ajv otherwise throws on unknown keywords in strict mode).
 */
export const registerAttributeSchemaKeywords = (ajv: Ajv): void => {
    for (const keyword of attributeAnnotationKeywords) {
        ajv.addKeyword({ keyword, validate: (): boolean => true });
    }

    ajv.addKeyword({
        keyword: 'x-increment-step',
        type: 'number',
        schemaType: 'number',
        validate: validateIncrementStep,
    });
};
