import { expectTypeOf } from 'vitest';
import BoolDeviceAttribute from '../../../src/device/attribute/boolDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../../src/device/attribute/deviceAttribute.js';

// create(): uninitialized, value may be undefined
const uninitialized = BoolDeviceAttribute.create('foo', 'Foo', DeviceAttributeModifier.readWrite);
expectTypeOf(uninitialized.value).toEqualTypeOf<boolean | undefined>();

// createInitialized(): value is guaranteed present, no undefined
const initialized = BoolDeviceAttribute.createInitialized('foo', 'Foo', DeviceAttributeModifier.readWrite, true);
expectTypeOf(initialized.value).toEqualTypeOf<boolean>();
