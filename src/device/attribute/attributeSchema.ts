import { Type } from '@sinclair/typebox';
import type { TInteger, TBoolean, TString, TNumber, Static } from '@sinclair/typebox';

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

/** A plain, unbounded integer attribute. */
export const intProperty = (options: CommonAttributeOptions & {
    uom?: string;
    default?: number;
}): TInteger => Type.Integer({
    ...commonKeywords(options),
    ...(options.uom !== undefined ? { 'x-uom': options.uom } : {}),
    ...(options.default !== undefined ? { default: options.default } : {}),
});

/** A plain, unbounded float attribute. */
export const floatProperty = (options: CommonAttributeOptions & {
    uom?: string;
    default?: number;
}): TNumber => Type.Number({
    ...commonKeywords(options),
    ...(options.uom !== undefined ? { 'x-uom': options.uom } : {}),
    ...(options.default !== undefined ? { default: options.default } : {}),
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

/** Numeric schemas that support range constraints. */
export type NumberMemberSchema = TInteger | TNumber;

/** Schemas whose values can be enumerated in a choice list. */
type ListableMemberSchema = TInteger | TNumber | TString;

/** A labeled choice for a list property. Value type is inferred from the base schema. */
export type Choice<T extends ListableMemberSchema> = { value: Static<T>, label: string };

/**
 * Enhances a numeric property with min/max bounds and an increment step.
 * @example
 * rangeProperty(intProperty({ label: 'Level' }), { min: 0, max: 100, incrementStep: 1 })
 * rangeProperty(floatProperty({ label: 'Gain', uom: 'dB' }), { min: 0, max: 1, incrementStep: 0.1 })
 */
export const rangeProperty = <T extends NumberMemberSchema>(base: T, options: {
    min: number;
    max: number;
    incrementStep: number;
}): T => ({
    ...base,
    'minimum': options.min,
    'maximum': options.max,
    'x-increment-step': options.incrementStep,
});

/**
 * Enhances a property with a fixed set of labeled choices (rendered as JSON Schema `oneOf`).
 * @example
 * listProperty(intProperty({ label: 'Mode' }), { choices: [{ value: 0, label: 'Off' }] })
 * listProperty(strProperty({ label: 'Color' }), { choices: [{ value: 'red', label: 'Red' }] })
 */
export const listProperty = <T extends ListableMemberSchema>(base: T, options: {
    choices: Choice<T>[];
}): T => ({
    ...base,
    oneOf: options.choices.map((choice): object => ({ 'const': choice.value, 'x-label': choice.label })),
});
