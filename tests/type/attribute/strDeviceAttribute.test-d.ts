import { expectTypeOf } from 'vitest';
import StrDeviceAttribute from '../../../src/device/attribute/strDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../../src/device/attribute/deviceAttribute.js';

// create(): uninitialized, value may be undefined
const uninitialized = StrDeviceAttribute.create('foo', 'Foo', DeviceAttributeModifier.readWrite);
expectTypeOf(uninitialized.value).toEqualTypeOf<string | undefined>();

// createInitialized(): value is guaranteed present, no undefined
const initialized = StrDeviceAttribute.createInitialized('foo', 'Foo', DeviceAttributeModifier.readWrite, 'bar');
expectTypeOf(initialized.value).toEqualTypeOf<string>();
