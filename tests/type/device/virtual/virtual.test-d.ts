import { expectTypeOf } from 'vitest';
import type VirtualDevice from '../../../../src/device/protocol/virtual/virtualDevice.js';
import type TtsVirtualDeviceLogic from '../../../../src/device/protocol/virtual/audio/ttsVirtualDeviceLogic.js';
import { Int } from '../../../../src/util/numbers.js';

declare const device: VirtualDevice<TtsVirtualDeviceLogic>;

// text: string | undefined
expectTypeOf(device.setAttribute('text', 'hello')).toEqualTypeOf<Promise<string | undefined>>();
expectTypeOf(device.setAttribute('text', undefined)).toEqualTypeOf<Promise<string | undefined>>();
// @ts-expect-error text does not accept an Int value
device.setAttribute('text', Int.from(1));

// speaking / queuing: boolean (initialized attribute, always has a value)
expectTypeOf(device.setAttribute('speaking', true)).toEqualTypeOf<Promise<boolean>>();
expectTypeOf(device.setAttribute('queuing', false)).toEqualTypeOf<Promise<boolean>>();
// @ts-expect-error queuing does not accept a string value
device.setAttribute('queuing', 'yes');

// queueLength: Int (initialized attribute, always has a value)
expectTypeOf(device.setAttribute('queueLength', Int.from(3))).toEqualTypeOf<Promise<Int>>();
// @ts-expect-error queueLength does not accept a boolean value
device.setAttribute('queueLength', true);

// @ts-expect-error unknown attribute name is rejected
device.setAttribute('doesNotExist', Int.from(1));
