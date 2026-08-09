import { expectTypeOf } from 'vitest';
import type { SerializedDevice } from '../../../src/device/serializedTypes.js';

declare const device: SerializedDevice;

// unnarrowed: common base fields are always available
expectTypeOf(device.deviceId).not.toBeUndefined();
expectTypeOf(device.state).not.toBeUndefined();
// @ts-expect-error `deviceModel` only exists on some variants, not accessible without narrowing
device.deviceModel;
// @ts-expect-error `fwVersion` only exists on some variants, not accessible without narrowing
device.fwVersion;

// narrowing via `type` discriminant resolves to the correct variant
if (device.type === 'zc95') {
    expectTypeOf(device.fwVersion).toEqualTypeOf<string>();
    // @ts-expect-error zc95 variant has no deviceModel field
    device.deviceModel;
}

if (device.type === 'estim2b') {
    expectTypeOf(device.fwVersion).toEqualTypeOf<string>();
    // @ts-expect-error estim2b variant has no deviceModel field
    device.deviceModel;
}

if (device.type === 'slvCtrlPlus') {
    expectTypeOf(device.deviceModel).toEqualTypeOf<string>();
    expectTypeOf(device.fwVersion).toEqualTypeOf<number>();
    expectTypeOf(device.protocolVersion).toEqualTypeOf<number>();
}

if (device.type === 'buttplugIo') {
    expectTypeOf(device.deviceModel).toEqualTypeOf<string>();
    // @ts-expect-error buttplugIo variant has no fwVersion field
    device.fwVersion;
}

if (device.type === 'virtual') {
    expectTypeOf(device.deviceModel).toEqualTypeOf<string>();
    expectTypeOf(device.fwVersion).toEqualTypeOf<string>();
}
