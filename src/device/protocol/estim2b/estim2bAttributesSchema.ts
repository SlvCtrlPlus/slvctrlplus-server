import { Type } from '@sinclair/typebox';
import type { TObject } from '@sinclair/typebox';
import { intProperty, rangeProperty, listProperty, boolProperty, strProperty } from '../../attribute/attributeSchema.js';
import { EStim2bMode } from './estim2bProtocol.js';

const CHANNEL_POWER_MIN = 0;
const CHANNEL_POWER_MAX = 100;
const PULSE_ATTR_MIN = 2;
const PULSE_ATTR_MAX = 100;

const formatMode = (str: string): string => {
    const withSpaces = str.replace(/([a-z])([A-Z])/g, '$1 $2');
    return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
};

const modeChoices = Object.entries(EStim2bMode)
    .filter(([key]) => !isNaN(Number(key)))
    .map(([key, value]) => ({
        value: parseInt(key, 10),
        label: typeof value === 'string' ? formatMode(value) : '',
    }));

type PulseConfig = {
    pulseFrequencyLabel: string;
    pulsePwmLabel?: string;
};

export const estim2bAttributesSchema = (pulse?: PulseConfig): TObject => Type.Object({
    mode: listProperty(intProperty({ label: 'Mode' }), { choices: modeChoices }),
    channelALevel: rangeProperty(intProperty({ label: 'Channel A' }), { min: CHANNEL_POWER_MIN, max: CHANNEL_POWER_MAX, incrementStep: 1 }),
    channelBLevel: rangeProperty(intProperty({ label: 'Channel B' }), { min: CHANNEL_POWER_MIN, max: CHANNEL_POWER_MAX, incrementStep: 1 }),
    ...(pulse !== undefined
        ? {
            pulseFrequency: rangeProperty(intProperty({ label: pulse.pulseFrequencyLabel }), { min: PULSE_ATTR_MIN, max: PULSE_ATTR_MAX, incrementStep: 1 }),
            ...(pulse.pulsePwmLabel !== undefined
                ? {
                    pulsePwm: rangeProperty(intProperty({ label: pulse.pulsePwmLabel }), { min: PULSE_ATTR_MIN, max: PULSE_ATTR_MAX, incrementStep: 1 }),
                }
                : {}),
        }
        : {}),
    channelsJoined: boolProperty({ label: 'Channels joined', readOnly: true }),
    highPowerMode: boolProperty({ label: 'High power mode' }),
    batteryStatus: strProperty({ label: 'Battery', readOnly: true }),
});

export type EStim2bAttributeValues = {
    mode: number;
    channelALevel: number;
    channelBLevel: number;
    pulseFrequency?: number;
    pulsePwm?: number;
    channelsJoined: boolean;
    highPowerMode: boolean;
    batteryStatus: string;
};

export const getPulseConfigForMode = (mode: EStim2bMode): PulseConfig | undefined => {
    switch (mode) {
        case EStim2bMode.pulse:
            return { pulseFrequencyLabel: 'Pulse Feel', pulsePwmLabel: 'Pulse PWM' };
        case EStim2bMode.bounce:
            return { pulseFrequencyLabel: 'Bounce Rate', pulsePwmLabel: 'Pulse Feel' };
        case EStim2bMode.continuous:
            return { pulseFrequencyLabel: 'Pulse Feel' };
        case EStim2bMode.aSplit:
            return { pulseFrequencyLabel: 'B Pulse Rate', pulsePwmLabel: 'Pulse Feel' };
        case EStim2bMode.bSplit:
            return { pulseFrequencyLabel: 'A Pulse Rate', pulsePwmLabel: 'Pulse Feel' };
        case EStim2bMode.wave:
        case EStim2bMode.waterfall:
            return { pulseFrequencyLabel: 'Flow', pulsePwmLabel: 'Granularity' };
        case EStim2bMode.squeeze:
        case EStim2bMode.milk:
            return { pulseFrequencyLabel: 'Pulse speed', pulsePwmLabel: 'Feel' };
        case EStim2bMode.throb:
        case EStim2bMode.thrust:
            return { pulseFrequencyLabel: 'Range' };
        case EStim2bMode.random:
            return { pulseFrequencyLabel: 'Range', pulsePwmLabel: 'Pulse Feel' };
        case EStim2bMode.step:
            return { pulseFrequencyLabel: 'Step Size', pulsePwmLabel: 'Pulse Feel' };
        case EStim2bMode.training:
            return { pulseFrequencyLabel: 'Jump Size', pulsePwmLabel: 'Pulse Feel' };
        default:
            return undefined;
    }
};
