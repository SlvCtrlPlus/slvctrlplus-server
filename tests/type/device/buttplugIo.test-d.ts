import { expectTypeOf } from 'vitest';
import type ButtplugIoDevice from '../../../src/device/protocol/buttplugIo/buttplugIoDevice.js';
import { Int } from '../../../src/util/numbers.js';

declare const device: ButtplugIoDevice;

// any valid actuator/sensor attribute key: Int | boolean (always initialized)
expectTypeOf(device.setAttribute('Vibrate-0', Int.from(50))).toEqualTypeOf<Promise<Int | boolean>>();
expectTypeOf(device.setAttribute('Rotate-1', true)).toEqualTypeOf<Promise<Int | boolean>>();
// @ts-expect-error attribute value cannot be a string
device.setAttribute('Vibrate-0', 'fast');

// @ts-expect-error unknown actuator/sensor type is rejected
device.setAttribute('Foobar-0', Int.from(1));
// @ts-expect-error attribute key must include a numeric index suffix
device.setAttribute('Vibrate', Int.from(1));
// @ts-expect-error attribute key index suffix must be numeric
device.setAttribute('Vibrate-abc', Int.from(1));
