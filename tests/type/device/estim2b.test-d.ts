import { expectTypeOf } from 'vitest';
import type EStim2bDevice from '../../../src/device/protocol/estim2b/estim2bDevice.js';
import { Int } from '../../../src/util/numbers.js';

declare const device: EStim2bDevice;

// mode: Int (list attribute key, always initialized)
expectTypeOf(device.setAttribute('mode', Int.from(0))).toEqualTypeOf<Promise<Int>>();
// @ts-expect-error mode does not accept a string value
device.setAttribute('mode', 'bounce');

// channelALevel / channelBLevel: Int (always initialized)
expectTypeOf(device.setAttribute('channelALevel', Int.from(50))).toEqualTypeOf<Promise<Int>>();
expectTypeOf(device.setAttribute('channelBLevel', Int.from(50))).toEqualTypeOf<Promise<Int>>();
// @ts-expect-error channelALevel does not accept a boolean value
device.setAttribute('channelALevel', true);

// pulseFrequency / pulsePwm: Int (always initialized)
expectTypeOf(device.setAttribute('pulseFrequency', Int.from(10))).toEqualTypeOf<Promise<Int>>();
expectTypeOf(device.setAttribute('pulsePwm', Int.from(10))).toEqualTypeOf<Promise<Int>>();
// @ts-expect-error pulseFrequency does not accept a string value
device.setAttribute('pulseFrequency', '10');

// channelsJoined / highPowerMode: boolean (always initialized)
expectTypeOf(device.setAttribute('channelsJoined', true)).toEqualTypeOf<Promise<boolean>>();
expectTypeOf(device.setAttribute('highPowerMode', false)).toEqualTypeOf<Promise<boolean>>();
// @ts-expect-error highPowerMode does not accept an Int value
device.setAttribute('highPowerMode', Int.from(1));

// batteryStatus: string (always initialized)
expectTypeOf(device.setAttribute('batteryStatus', 'mains')).toEqualTypeOf<Promise<string>>();
// @ts-expect-error batteryStatus does not accept a boolean value
device.setAttribute('batteryStatus', true);

// @ts-expect-error unknown attribute name is rejected
device.setAttribute('doesNotExist', Int.from(1));
