import { assertType, expectTypeOf } from 'vitest';
import type Zc95Device from '../../../../src/device/protocol/zc95/zc95Device.js';
import type { Zc95StartedDeviceApi } from '../../../../src/device/protocol/zc95/zc95Device.js';

declare const device: Zc95Device;

// --- Before narrowing: only common keys (activePattern, patternStarted) are available ---

expectTypeOf(device.setAttribute('activePattern', 5)).toEqualTypeOf<Promise<number>>();
expectTypeOf(device.setAttribute('patternStarted', false)).toEqualTypeOf<Promise<boolean>>();

// getAttributeValue returns union of possible value types
expectTypeOf(device.getAttributeValue('activePattern')).toEqualTypeOf<number | undefined>();

// @ts-expect-error powerChannel keys are NOT available on the un-narrowed device
device.setAttribute('powerChannel1', 50);

// @ts-expect-error patternAttribute keys are NOT available on the un-narrowed device
device.setAttribute('patternAttribute3', 10);

// --- After narrowing with isPatternStarted(): started-state keys become available ---

if (device.isPatternStarted()) {
    // The narrowed device exposes power channel keys with precise number type
    expectTypeOf(device.setAttribute('powerChannel1', 50)).toEqualTypeOf<Promise<number>>();
    expectTypeOf(device.setAttribute('powerChannel4', 50)).toEqualTypeOf<Promise<number>>();

    // Pattern attribute keys are also available
    expectTypeOf(device.setAttribute('patternAttribute3', 10)).toEqualTypeOf<Promise<number | undefined>>();

    // getAttributeValue works for started-state keys
    expectTypeOf(device.getAttributeValue('powerChannel1')).toEqualTypeOf<number | undefined>();

    // Common keys still work
    expectTypeOf(device.setAttribute('activePattern', 1)).toEqualTypeOf<Promise<number>>();

    // @ts-expect-error powerChannel5 is not a valid power channel index
    device.setAttribute('powerChannel5', 50);
}

// --- isPatternStarted() returns a proper type predicate ---
assertType<(this: Zc95Device) => this is Zc95Device & Zc95StartedDeviceApi>(device.isPatternStarted);
