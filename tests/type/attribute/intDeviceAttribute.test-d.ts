import { expectTypeOf } from 'vitest';
import IntDeviceAttribute from '../../../src/device/attribute/intDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../../src/device/attribute/deviceAttribute.js';
import type { Nullable, Uninitialized } from '../../../src/device/attribute/deviceAttribute.js';
import { Int } from '../../../src/util/numbers.js';

// plain create(): value always present, no null/undefined
const plain = IntDeviceAttribute.create({ name: 'foo', label: 'Foo', modifier: DeviceAttributeModifier.readWrite, initialValue: Int.from(1) });
expectTypeOf(plain.value).toEqualTypeOf<Int>();

// uninitialized: true - value may be undefined (only assignable at construction)
const uninitialized = IntDeviceAttribute.create({ name: 'foo', modifier: DeviceAttributeModifier.readWrite, uninitialized: true, initialValue: undefined });
expectTypeOf(uninitialized.value).toEqualTypeOf<Int | undefined>();

// nullable: true - value may be null (assignable at any time)
const nullable = IntDeviceAttribute.create({ name: 'foo', modifier: DeviceAttributeModifier.readWrite, nullable: true, initialValue: null });
expectTypeOf(nullable.value).toEqualTypeOf<Int | null>();

// @ts-expect-error a non-nullable, non-uninitialized attribute cannot be constructed with null
IntDeviceAttribute.create({ name: 'foo', modifier: DeviceAttributeModifier.readWrite, initialValue: null });

// create() collapses to the canonical presence markers, so results are assignable to them
const _plainAsBare: IntDeviceAttribute = plain;
const _uninitializedAsUninitialized: IntDeviceAttribute<Uninitialized> = uninitialized;
const _nullableAsNullable: IntDeviceAttribute<Nullable> = nullable;

// @ts-expect-error a nullable attribute is not assignable to a plain (Initialized) attribute
const badPlain: IntDeviceAttribute = nullable;
// @ts-expect-error an uninitialized attribute is not assignable to a Nullable attribute
const badNullable: IntDeviceAttribute<Nullable> = uninitialized;
