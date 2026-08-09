import { expectTypeOf } from 'vitest';
import IntRangeDeviceAttribute from '../../../src/device/attribute/intRangeDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../../src/device/attribute/deviceAttribute.js';
import { Int } from '../../../src/util/numbers.js';

// create(): uninitialized, value may be undefined
const uninitialized = IntRangeDeviceAttribute.create(
    'foo', 'Foo', DeviceAttributeModifier.readWrite, undefined, Int.from(0), Int.from(100), Int.from(1),
);
expectTypeOf(uninitialized.value).toEqualTypeOf<Int | undefined>();

// createInitialized(): value is guaranteed present, no undefined
const initialized = IntRangeDeviceAttribute.createInitialized(
    'foo', 'Foo', DeviceAttributeModifier.readWrite, undefined, Int.from(0), Int.from(100), Int.from(1), Int.from(50),
);
expectTypeOf(initialized.value).toEqualTypeOf<Int>();
