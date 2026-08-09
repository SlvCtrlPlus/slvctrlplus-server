import { expectTypeOf } from 'vitest';
import FloatDeviceAttribute from '../../../src/device/attribute/floatDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../../src/device/attribute/deviceAttribute.js';
import { Float } from '../../../src/util/numbers.js';

// create(): uninitialized, value may be undefined
const uninitialized = FloatDeviceAttribute.create('foo', 'Foo', DeviceAttributeModifier.readWrite, undefined);
expectTypeOf(uninitialized.value).toEqualTypeOf<Float | undefined>();

// createInitialized(): value is guaranteed present, no undefined
const initialized = FloatDeviceAttribute.createInitialized(
    'foo', 'Foo', DeviceAttributeModifier.readWrite, undefined, Float.from(1.5),
);
expectTypeOf(initialized.value).toEqualTypeOf<Float>();
