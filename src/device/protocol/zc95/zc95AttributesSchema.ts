import { Type } from '@sinclair/typebox';
import type { Static, TInteger } from '@sinclair/typebox';
import { listIntProperty, rangeIntProperty } from '../../attribute/attributeSchema.js';
import type { IntChoice } from '../../attribute/attributeSchema.js';
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
            properties[String(menuItem.Id)] = rangeIntProperty({
                label: menuItem.Title,
                group: menuItem.Group,
                uom: 'us' === menuItem.UoM ? 'µs' : menuItem.UoM,
                min: menuItem.Min,
                max: menuItem.Max,
                incrementStep: menuItem.IncrementStep,
                default: menuItem.Default,
            });
        } else if (isMultiChoiceMenuItem(menuItem)) {
            const choices: IntChoice[] = menuItem.Choices.map((choice): IntChoice => ({ value: choice.Id, label: choice.Name }));

            properties[String(menuItem.Id)] = listIntProperty({
                label: menuItem.Title,
                group: menuItem.Group,
                choices,
                default: menuItem.Default,
            });
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
    const patternChoices: IntChoice[] = input.patterns.map((pattern): IntChoice => ({ value: pattern.Id, label: pattern.Name }));
    const activePatternProp = listIntProperty({ label: 'Pattern', choices: patternChoices, default: 0 });

    const stoppedSchema = Type.Object({
        activePattern: activePatternProp,
        patternStarted: Type.Literal(false, { 'x-label': 'Pattern Started' }),
    }, { additionalProperties: false });

    const { One, Two, Three, Four } = Zc95DevicePowerChannelIndex;
    const hasPowerChannels = input.powerChannels.length > 0;

    const powerChannelsSchema = Type.Object({
        [One]: rangeIntProperty({ label: 'Channel 1', min: 0, max: findMaxPower(input.powerChannels, One), incrementStep: 1, default: 0 }),
        [Two]: rangeIntProperty({ label: 'Channel 2', min: 0, max: findMaxPower(input.powerChannels, Two), incrementStep: 1, default: 0 }),
        [Three]: rangeIntProperty({ label: 'Channel 3', min: 0, max: findMaxPower(input.powerChannels, Three), incrementStep: 1, default: 0 }),
        [Four]: rangeIntProperty({ label: 'Channel 4', min: 0, max: findMaxPower(input.powerChannels, Four), incrementStep: 1, default: 0 }),
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
