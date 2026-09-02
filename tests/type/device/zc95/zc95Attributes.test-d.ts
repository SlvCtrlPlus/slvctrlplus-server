import type { AllOrNone } from '../../../../src/types.js';
import type { Zc95DeviceAttributes } from '../../../../src/device/protocol/zc95/zc95Device.js';
import ListDeviceAttribute from '../../../../src/device/attribute/listDeviceAttribute.js';
import IntRangeDeviceAttribute from '../../../../src/device/attribute/intRangeDeviceAttribute.js';
import BoolDeviceAttribute from '../../../../src/device/attribute/boolDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../../../src/device/attribute/deviceAttribute.js';
import { Int } from '../../../../src/util/numbers.js';

const activePattern = ListDeviceAttribute.createInitialized<Int, string>(
    'activePattern', 'Active pattern', DeviceAttributeModifier.readWrite, [], Int.from(1),
);
const patternStarted = BoolDeviceAttribute.create({
    name: 'patternStarted', label: 'Pattern started', modifier: DeviceAttributeModifier.readWrite, initialValue: false,
});
const powerChannel = (name: string): IntRangeDeviceAttribute => IntRangeDeviceAttribute.create({
    name, label: name, modifier: DeviceAttributeModifier.readWrite, min: Int.ZERO, max: Int.from(100), initialValue: Int.ZERO,
});

// `AllOrNone<T>` in isolation correctly enforces "all keys or none":
type Channels = { a: number, b: number, c: number, d: number };
const allDefined: AllOrNone<Channels> = { a: 1, b: 2, c: 3, d: 4 };
const noneDefined: AllOrNone<Channels> = {};
// @ts-expect-error only some keys present - AllOrNone correctly rejects this in isolation
const partialDefined: AllOrNone<Channels> = { a: 1 };

// valid: all 4 power channels present
const withAllChannels: Zc95DeviceAttributes = {
    activePattern,
    patternStarted,
    powerChannel1: powerChannel('powerChannel1'),
    powerChannel2: powerChannel('powerChannel2'),
    powerChannel3: powerChannel('powerChannel3'),
    powerChannel4: powerChannel('powerChannel4'),
};

// valid: none of the power channels present
const withNoChannels: Zc95DeviceAttributes = {
    activePattern,
    patternStarted,
};

// @ts-expect-error only powerChannel1 present, missing powerChannel2-4 (AllOrNone violated)
const withPartialChannels: Zc95DeviceAttributes = {
    activePattern,
    patternStarted,
    powerChannel1: powerChannel('powerChannel1'),
};
