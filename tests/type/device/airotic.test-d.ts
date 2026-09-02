import { expectTypeOf } from 'vitest';
import type AiroticDevice from '../../../src/device/protocol/airotic/airoticDevice.js';
import { Float } from '../../../src/util/numbers.js';

declare const device: AiroticDevice;

// restColor / breathInColor: string | undefined (undefined only possible at construction)
expectTypeOf(device.setAttribute('restColor', '0,0,255')).toEqualTypeOf<Promise<string | undefined>>();
expectTypeOf(device.setAttribute('breathInColor', '255,0,128')).toEqualTypeOf<Promise<string | undefined>>();
// @ts-expect-error restColor does not accept a boolean value
device.setAttribute('restColor', true);

// resetColors / reboot: boolean (always initialized)
expectTypeOf(device.setAttribute('resetColors', true)).toEqualTypeOf<Promise<boolean>>();
expectTypeOf(device.setAttribute('reboot', false)).toEqualTypeOf<Promise<boolean>>();
// @ts-expect-error resetColors does not accept a string value
device.setAttribute('resetColors', 'yes');

// breathsPerMin: Float | null (reset to null when no recent breath data)
expectTypeOf(device.setAttribute('breathsPerMin', Float.from(12.5))).toEqualTypeOf<Promise<Float | null>>();
// @ts-expect-error breathsPerMin does not accept a boolean value
device.setAttribute('breathsPerMin', true);

// bpmTrend: string | null (reset to null when no recent breath data)
expectTypeOf(device.setAttribute('bpmTrend', 'up')).toEqualTypeOf<Promise<string | null>>();

// @ts-expect-error unknown attribute name is rejected
device.setAttribute('doesNotExist', 'foo');
