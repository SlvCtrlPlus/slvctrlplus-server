import { expectTypeOf } from 'vitest';
import IntDeviceAttribute from '../../../src/device/attribute/intDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../../src/device/attribute/deviceAttribute.js';
import { Int } from '../../../src/util/numbers.js';

// create(): uninitialized, value may be undefined
const uninitialized = IntDeviceAttribute.create('foo', 'Foo', DeviceAttributeModifier.readWrite, undefined);
expectTypeOf(uninitialized.value).toEqualTypeOf<Int | undefined>();

// createInitialized(): value is guaranteed present, no undefined
const initialized = IntDeviceAttribute.createInitialized(
    'foo', 'Foo', DeviceAttributeModifier.readWrite, undefined, Int.from(1),
);
expectTypeOf(initialized.value).toEqualTypeOf<Int>();
