import { expectTypeOf } from 'vitest';
import type Zc95Device from '../../../../src/device/protocol/zc95/zc95Device.js';
import { Int } from '../../../../src/util/numbers.js';

declare const device: Zc95Device;

// activePattern: Int (initialized list attribute, always has a value)
expectTypeOf(device.setAttribute('activePattern', Int.from(1))).toEqualTypeOf<Promise<Int>>();
// @ts-expect-error activePattern does not accept a string value
device.setAttribute('activePattern', 'pattern-1');

// patternStarted: boolean (initialized bool attribute, always has a value)
expectTypeOf(device.setAttribute('patternStarted', true)).toEqualTypeOf<Promise<boolean>>();
// @ts-expect-error patternStarted does not accept an Int value
device.setAttribute('patternStarted', Int.from(1));

// powerChannel1-4 (dynamic, fixed suffix 1|2|3|4): Int | undefined
expectTypeOf(device.setAttribute('powerChannel1', Int.from(50))).toEqualTypeOf<Promise<Int | undefined>>();
expectTypeOf(device.setAttribute('powerChannel4', Int.from(50))).toEqualTypeOf<Promise<Int | undefined>>();
// @ts-expect-error powerChannel5 is not a valid power channel index
device.setAttribute('powerChannel5', Int.from(50));

// patternAttribute<N> (dynamic, numeric suffix): Int | undefined
expectTypeOf(device.setAttribute('patternAttribute3', Int.from(10))).toEqualTypeOf<Promise<Int | undefined>>();
// @ts-expect-error patternAttribute suffix must be numeric
device.setAttribute('patternAttributeFoo', Int.from(10));

// @ts-expect-error unknown attribute name is rejected
device.setAttribute('doesNotExist', Int.from(1));
