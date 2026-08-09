import { expectTypeOf } from 'vitest';
import ListDeviceAttribute from '../../../src/device/attribute/listDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../../src/device/attribute/deviceAttribute.js';
import { Int } from '../../../src/util/numbers.js';

const options = [{ key: Int.from(1), value: 'one' }, { key: Int.from(2), value: 'two' }];

// create(): uninitialized, value may be undefined
const uninitialized = ListDeviceAttribute.create('foo', 'Foo', DeviceAttributeModifier.readWrite, options);
expectTypeOf(uninitialized.value).toEqualTypeOf<Int | undefined>();

// createInitialized(): value is guaranteed present, no undefined
const initialized = ListDeviceAttribute.createInitialized(
    'foo', 'Foo', DeviceAttributeModifier.readWrite, options, Int.from(1),
);
expectTypeOf(initialized.value).toEqualTypeOf<Int>();
