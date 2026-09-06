import { Type } from '@sinclair/typebox';
import type { TObject, TSchema } from '@sinclair/typebox';
import { boolProperty, listIntProperty, rangeIntProperty } from '../../attribute/attributeSchema.js';
import type { IntChoice } from '../../attribute/attributeSchema.js';
import type { MenuItem, MinMaxMenuItem, MultiChoiceMenuItem, PatternsMsgResponse } from './zc95MessageFactory.js';

import type { Zc95DevicePowerChannelIndex } from './zc95Device.js';

type PatternDetail = PatternsMsgResponse['Patterns'][number];

const patternAttributePrefix = 'patternAttribute';
const powerChannelAttributePrefix = 'powerChannel';

const isMinMaxMenuItem = (menuItem: MenuItem): menuItem is MinMaxMenuItem => 'MIN_MAX' === menuItem.Type;
const isMultiChoiceMenuItem = (menuItem: MenuItem): menuItem is MultiChoiceMenuItem => 'MULTI_CHOICE' === menuItem.Type;

/** Builds the schema properties for the pattern-specific attributes reported by the currently active pattern's menu items. */
const patternAttributeProperties = (menuItems: (MinMaxMenuItem | MultiChoiceMenuItem)[]): Record<string, TSchema> => {
    const properties: Record<string, TSchema> = {};

    for (const menuItem of menuItems) {
        const propertyName = `${patternAttributePrefix}${menuItem.Id}`;

        if (isMinMaxMenuItem(menuItem)) {
            properties[propertyName] = rangeIntProperty({
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

            properties[propertyName] = listIntProperty({
                label: menuItem.Title,
                group: menuItem.Group,
                choices,
                default: menuItem.Default,
            });
        }
    }

    return properties;
};

/** Builds the schema properties for the four power channel attributes. */
const powerChannelProperties = (channels: { channel: Zc95DevicePowerChannelIndex, maxOutputPower: number }[]): Record<string, TSchema> => {
    const properties: Record<string, TSchema> = {};

    for (const { channel, maxOutputPower } of channels) {
        properties[`${powerChannelAttributePrefix}${channel}`] = rangeIntProperty({
            label: `Channel ${channel}`,
            min: 0,
            max: maxOutputPower,
            incrementStep: 1,
            default: 0,
        });
    }

    return properties;
};

type Zc95PowerChannelValues = {
    powerChannel1: number;
    powerChannel2: number;
    powerChannel3: number;
    powerChannel4: number;
};

type Zc95BaseAttributes = {
    activePattern: number;
};

/** Pattern is stopped — only activePattern and patternStarted are present. */
type Zc95StoppedAttributes = Zc95BaseAttributes & {
    patternStarted: false;
};

/** Pattern is running — power channels and pattern-specific attributes are also present. */
export type Zc95StartedAttributes = Zc95BaseAttributes & {
    patternStarted: true;
} & Zc95PowerChannelValues & Partial<Record<`patternAttribute${number}`, number>>;

/** Discriminated union: attribute shape depends on whether a pattern is running. */
export type Zc95AttributeValues = Zc95StoppedAttributes | Zc95StartedAttributes;

/**
 * Builds the JSON Schema describing a zc95 device's current attributes: the static
 * `patternStarted`/`activePattern`/power channel properties plus the dynamic pattern-specific
 * properties reported by the device for the currently active pattern.
 *
 * This is a pure projection of the device's current capability/state and is meant to be
 * rebuilt (along with its compiled validator) whenever the active pattern or a power limit changes.
 */
export const zc95AttributesSchema = (input: {
    patterns: PatternDetail[];
    activePatternMenuItems: (MinMaxMenuItem | MultiChoiceMenuItem)[];
    powerChannels: { channel: Zc95DevicePowerChannelIndex, maxOutputPower: number }[];
}): TObject => {
    const patternChoices: IntChoice[] = input.patterns.map((pattern): IntChoice => ({ value: pattern.Id, label: pattern.Name }));

    return Type.Object({
        activePattern: listIntProperty({ label: 'Pattern', choices: patternChoices, default: 0 }),
        patternStarted: boolProperty({ label: 'Pattern Started', default: false }),
        ...powerChannelProperties(input.powerChannels),
        ...patternAttributeProperties(input.activePatternMenuItems),
    }, { additionalProperties: false });
};
