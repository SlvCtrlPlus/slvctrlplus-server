import { expectTypeOf } from 'vitest';
import IntRangeDeviceAttribute from '../../../src/device/attribute/intRangeDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../../src/device/attribute/deviceAttribute.js';
import type { Nullable, Uninitialized } from '../../../src/device/attribute/deviceAttribute.js';
import { Int } from '../../../src/util/numbers.js';

// plain create(): value always present, no null/undefined
const plain = IntRangeDeviceAttribute.create({
    name: 'foo', label: 'Foo', modifier: DeviceAttributeModifier.readWrite, min: Int.from(0), max: Int.from(100), initialValue: Int.from(50),
});
expectTypeOf(plain.value).toEqualTypeOf<Int>();

// uninitialized: true - value may be undefined (only assignable at construction)
const uninitialized = IntRangeDeviceAttribute.create({
    name: 'foo', modifier: DeviceAttributeModifier.readWrite, min: Int.from(0), max: Int.from(100), uninitialized: true, initialValue: undefined,
});
expectTypeOf(uninitialized.value).toEqualTypeOf<Int | undefined>();

// nullable: true - value may be null (assignable at any time)
const nullable = IntRangeDeviceAttribute.create({
    name: 'foo', modifier: DeviceAttributeModifier.readWrite, min: Int.from(0), max: Int.from(100), nullable: true, initialValue: null,
});
expectTypeOf(nullable.value).toEqualTypeOf<Int | null>();

// @ts-expect-error a non-nullable, non-uninitialized attribute cannot be constructed with null
IntRangeDeviceAttribute.create({ name: 'foo', modifier: DeviceAttributeModifier.readWrite, min: Int.from(0), max: Int.from(100), initialValue: null });

// create() collapses to the canonical presence markers, so results are assignable to them
const _plainAsBare: IntRangeDeviceAttribute = plain;
const _uninitializedAsUninitialized: IntRangeDeviceAttribute<Uninitialized> = uninitialized;
const _nullableAsNullable: IntRangeDeviceAttribute<Nullable> = nullable;

// @ts-expect-error a nullable attribute is not assignable to a plain (Initialized) attribute
const badPlain: IntRangeDeviceAttribute = nullable;
// @ts-expect-error an uninitialized attribute is not assignable to a Nullable attribute
const badNullable: IntRangeDeviceAttribute<Nullable> = uninitialized;
