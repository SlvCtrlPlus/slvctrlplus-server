import { Type } from '@sinclair/typebox';
import type { Static, TInteger } from '@sinclair/typebox';
import { intProperty, listProperty, rangeProperty } from '../../attribute/attributeSchema.js';
import type { Choice } from '../../attribute/attributeSchema.js';
import type { MenuItem, MinMaxMenuItem, MultiChoiceMenuItem, PatternsMsgResponse } from './zc95MessageFactory.js';
import { Zc95DevicePowerChannelIndex } from './zc95Device.js';

type PatternDetail = PatternsMsgResponse['Patterns'][number];

const isMinMaxMenuItem = (menuItem: MenuItem): menuItem is MinMaxMenuItem => 'MIN_MAX' === menuItem.Type;
const isMultiChoiceMenuItem = (menuItem: MenuItem): menuItem is MultiChoiceMenuItem => 'MULTI_CHOICE' === menuItem.Type;

/** Builds the schema properties for pattern-specific menu items, keyed by bare menu-item id. */
const patternAttributeProperties = (menuItems: (MinMaxMenuItem | MultiChoiceMenuItem)[]): Record<string, TInteger> => {
    const properties: Record<string, TInteger> = {};

    for (const menuItem of menuItems) {
        if (isMinMaxMenuItem(menuItem)) {
            properties[String(menuItem.Id)] = rangeProperty(intProperty({
                label: menuItem.Title,
                group: menuItem.Group,
                uom: 'us' === menuItem.UoM ? 'µs' : menuItem.UoM,
                default: menuItem.Default,
            }), {
                min: menuItem.Min,
                max: menuItem.Max,
                incrementStep: menuItem.IncrementStep,
            });
        } else if (isMultiChoiceMenuItem(menuItem)) {
            const choices: Choice<TInteger>[] = menuItem.Choices.map((choice): Choice<TInteger> => ({ value: choice.Id, label: choice.Name }));

            properties[String(menuItem.Id)] = listProperty(intProperty({
                label: menuItem.Title,
                group: menuItem.Group,
                default: menuItem.Default,
            }), { choices });
        }
    }

    return properties;
};

export type Zc95SchemaInput = {
    patterns: PatternDetail[];
    activePatternMenuItems: (MinMaxMenuItem | MultiChoiceMenuItem)[];
    powerChannels: { channel: Zc95DevicePowerChannelIndex, maxOutputPower: number }[];
};

/**
 * Builds a discriminated-union JSON Schema describing a zc95 device's current attributes.
 *
 * Three possible branches (discriminated on `patternStarted`):
 * - **stopped**: `{ activePattern, patternStarted: false }`
 * - **started (loading)**: `{ activePattern, patternStarted: true, patternAttributes }` — no powerChannels yet
 * - **started (full)**: `{ activePattern, patternStarted: true, powerChannels, patternAttributes }`
 *
 * `Static<>` on the return type gives a proper TS discriminated union — no hand-written types needed.
 */
const findMaxPower = (channels: Zc95SchemaInput['powerChannels'], index: Zc95DevicePowerChannelIndex): number =>
    channels.find(c => c.channel === index)?.maxOutputPower ?? 0;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types -- return type must be inferred so Static<ReturnType<...>> derives the full discriminated union
export const zc95AttributesSchema = (input: Zc95SchemaInput) => {
    const patternChoices: Choice<TInteger>[] = input.patterns.map((pattern): Choice<TInteger> => ({ value: pattern.Id, label: pattern.Name }));
    const activePatternProp = listProperty(intProperty({ label: 'Pattern', default: 0 }), { choices: patternChoices });

    const stoppedSchema = Type.Object({
        activePattern: activePatternProp,
        patternStarted: Type.Literal(false, { 'x-label': 'Pattern Started' }),
    }, { additionalProperties: false });

    const { One, Two, Three, Four } = Zc95DevicePowerChannelIndex;
    const hasPowerChannels = input.powerChannels.length > 0;

    const powerChannelsSchema = Type.Object({
        [One]: rangeProperty(intProperty({ label: 'Channel 1', default: 0 }), { min: 0, max: findMaxPower(input.powerChannels, One), incrementStep: 1 }),
        [Two]: rangeProperty(intProperty({ label: 'Channel 2', default: 0 }), { min: 0, max: findMaxPower(input.powerChannels, Two), incrementStep: 1 }),
        [Three]: rangeProperty(intProperty({ label: 'Channel 3', default: 0 }), { min: 0, max: findMaxPower(input.powerChannels, Three), incrementStep: 1 }),
        [Four]: rangeProperty(intProperty({ label: 'Channel 4', default: 0 }), { min: 0, max: findMaxPower(input.powerChannels, Four), incrementStep: 1 }),
    });

    const patternAttributesSchema = Type.Object(
        patternAttributeProperties(input.activePatternMenuItems),
        { additionalProperties: false },
    );

    const startedBase = {
        activePattern: activePatternProp,
        patternStarted: Type.Literal(true, { 'x-label': 'Pattern Started' }),
        patternAttributes: patternAttributesSchema,
    };

    const startedSchemas = hasPowerChannels
        ? [Type.Object({ ...startedBase, powerChannels: powerChannelsSchema }, { additionalProperties: false })]
        : [
            Type.Object(startedBase, { additionalProperties: false }),
            Type.Object({ ...startedBase, powerChannels: powerChannelsSchema }, { additionalProperties: false }),
        ];

    return Type.Union([stoppedSchema, ...startedSchemas]);
};

/** Derived value type from the schema — discriminated union on `patternStarted`. */
export type Zc95AttributeValues = Static<ReturnType<typeof zc95AttributesSchema>>;

/** The started branch(es) of the discriminated union — may or may not have powerChannels. */
export type Zc95StartedAttributes = Extract<Zc95AttributeValues, { patternStarted: true }>;

/** Started with powerChannels present (after first PowerStatus message). */
export type Zc95StartedWithPowerAttributes = Extract<Zc95StartedAttributes, { powerChannels: Record<string, number> }>;

/** The stopped branch of the discriminated union — available after narrowing. */
export type Zc95StoppedAttributes = Extract<Zc95AttributeValues, { patternStarted: false }>;
