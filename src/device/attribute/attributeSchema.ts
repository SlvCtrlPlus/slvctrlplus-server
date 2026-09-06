import { Type } from '@sinclair/typebox';
import type { TInteger, TBoolean, TString } from '@sinclair/typebox';

/**
 * A single labeled member of an integer "list" attribute, e.g. `{ value: 0, label: 'Sine' }`.
 * Rendered on the wire as a JSON Schema `oneOf` entry: `{ const: 0, 'x-label': 'Sine' }`.
 */
export type IntChoice = { value: number, label: string };

type CommonAttributeOptions = {
    label: string;
    group?: number;
    readOnly?: boolean;
    writeOnly?: boolean;
};

const modifierKeywords = (options: CommonAttributeOptions): { readOnly?: true, writeOnly?: true } => ({
    ...(options.readOnly === true ? { readOnly: true } : {}),
    ...(options.writeOnly === true ? { writeOnly: true } : {}),
});

const commonKeywords = (options: CommonAttributeOptions): Record<string, unknown> => ({
    'x-label': options.label,
    ...(options.group !== undefined ? { 'x-group': options.group } : {}),
    ...modifierKeywords(options),
});

/** A bounded, steppable integer attribute (e.g. a range slider). */
export const rangeIntProperty = (options: CommonAttributeOptions & {
    min: number;
    max: number;
    incrementStep: number;
    uom?: string;
    default?: number;
}): TInteger => Type.Integer({
    ...commonKeywords(options),
    ...(options.uom !== undefined ? { 'x-uom': options.uom } : {}),
    'minimum': options.min,
    'maximum': options.max,
    'x-increment-step': options.incrementStep,
    ...(options.default !== undefined ? { default: options.default } : {}),
});

/** A plain, unbounded integer attribute. */
export const intProperty = (options: CommonAttributeOptions & {
    uom?: string;
    default?: number;
}): TInteger => Type.Integer({
    ...commonKeywords(options),
    ...(options.uom !== undefined ? { 'x-uom': options.uom } : {}),
    ...(options.default !== undefined ? { default: options.default } : {}),
});

/** An integer attribute whose value must be one of a fixed, labeled set of choices. */
export const listIntProperty = (options: CommonAttributeOptions & {
    choices: IntChoice[];
    default?: number;
}): TInteger => Type.Integer({
    ...commonKeywords(options),
    ...(options.default !== undefined ? { default: options.default } : {}),
    oneOf: options.choices.map((choice): object => ({ 'const': choice.value, 'x-label': choice.label })),
});

export const boolProperty = (options: CommonAttributeOptions & {
    default?: boolean;
}): TBoolean => Type.Boolean({
    ...commonKeywords(options),
    ...(options.default !== undefined ? { default: options.default } : {}),
});

export const strProperty = (options: CommonAttributeOptions & {
    default?: string;
}): TString => Type.String({
    ...commonKeywords(options),
    ...(options.default !== undefined ? { default: options.default } : {}),
});
