import { assertType, expectTypeOf } from 'vitest';
import type Zc95Device from '../../../../src/device/protocol/zc95/zc95Device.js';
import type { Zc95StartedDeviceApi } from '../../../../src/device/protocol/zc95/zc95Device.js';
import type { Zc95AttributeValues, Zc95StartedAttributes } from '../../../../src/device/protocol/zc95/zc95AttributesSchema.js';
import type { DeviceDataUpdateResult } from '../../../../src/device/device.js';

declare const device: Zc95Device;

// --- getDeviceData returns the full union ---
expectTypeOf(device.getDeviceData()).toEqualTypeOf<Zc95AttributeValues>();

// --- getAttributesSchema is available ---
expectTypeOf(device.getAttributesSchema).toBeFunction();

// --- After narrowing with isPatternStarted(): started-state data is available ---

if (device.isPatternStarted()) {
    // After narrowing, getDeviceData still returns the union (structuredClone breaks narrowing),
    // but the discriminant can be used to narrow the result
    const data = device.getDeviceData();
    if (data.patternStarted) {
        expectTypeOf(data.patternAttributes).toEqualTypeOf<Record<string, number>>();
    }

    // updateDeviceData accepts started-state updates
    expectTypeOf(device.updateDeviceData({ powerChannels: { 1: 50 } }))
        .toEqualTypeOf<Promise<DeviceDataUpdateResult<Zc95AttributeValues>>>();
}

// --- isPatternStarted() returns a proper type predicate ---
assertType<(this: Zc95Device) => this is Zc95Device & Zc95StartedDeviceApi>(device.isPatternStarted);
