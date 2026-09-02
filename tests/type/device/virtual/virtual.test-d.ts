import { expectTypeOf } from 'vitest';
import type VirtualDevice from '../../../../src/device/protocol/virtual/virtualDevice.js';
import type TtsVirtualDeviceLogic from '../../../../src/device/protocol/virtual/audio/ttsVirtualDeviceLogic.js';
import { Int } from '../../../../src/util/numbers.js';

declare const device: VirtualDevice<TtsVirtualDeviceLogic>;

// text: string | null (reset to null once consumed; undefined only ever possible at construction,
// and setAttribute's value type excludes it - see virtualDevice.ts)
expectTypeOf(device.setAttribute('text', 'hello')).toEqualTypeOf<Promise<string | null>>();
expectTypeOf(device.setAttribute('text', null)).toEqualTypeOf<Promise<string | null>>();
// @ts-expect-error setAttribute excludes undefined - use null to reset a value
device.setAttribute('text', undefined);
// @ts-expect-error text does not accept an Int value
device.setAttribute('text', Int.from(1));

// speaking / queuing: boolean (always initialized)
expectTypeOf(device.setAttribute('speaking', true)).toEqualTypeOf<Promise<boolean>>();
expectTypeOf(device.setAttribute('queuing', false)).toEqualTypeOf<Promise<boolean>>();
// @ts-expect-error queuing does not accept a string value
device.setAttribute('queuing', 'yes');

// queueLength: Int (always initialized)
expectTypeOf(device.setAttribute('queueLength', Int.from(3))).toEqualTypeOf<Promise<Int>>();
// @ts-expect-error queueLength does not accept a boolean value
device.setAttribute('queueLength', true);

// @ts-expect-error unknown attribute name is rejected
device.setAttribute('doesNotExist', Int.from(1));
