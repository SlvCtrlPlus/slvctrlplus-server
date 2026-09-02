import { expectTypeOf } from 'vitest';
import StrDeviceAttribute from '../../../src/device/attribute/strDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../../src/device/attribute/deviceAttribute.js';
import type { Nullable, Uninitialized } from '../../../src/device/attribute/deviceAttribute.js';

// plain create(): value always present, no null/undefined
const plain = StrDeviceAttribute.create({ name: 'foo', label: 'Foo', modifier: DeviceAttributeModifier.readWrite, initialValue: 'bar' });
expectTypeOf(plain.value).toEqualTypeOf<string>();

// uninitialized: true - value may be undefined (only assignable at construction)
const uninitialized = StrDeviceAttribute.create({ name: 'foo', modifier: DeviceAttributeModifier.readWrite, uninitialized: true, initialValue: undefined });
expectTypeOf(uninitialized.value).toEqualTypeOf<string | undefined>();

// nullable: true - value may be null (assignable at any time)
const nullable = StrDeviceAttribute.create({ name: 'foo', modifier: DeviceAttributeModifier.readWrite, nullable: true, initialValue: null });
expectTypeOf(nullable.value).toEqualTypeOf<string | null>();

// @ts-expect-error a non-nullable, non-uninitialized attribute cannot be constructed with null
StrDeviceAttribute.create({ name: 'foo', modifier: DeviceAttributeModifier.readWrite, initialValue: null });

// create() collapses to the canonical presence markers, so results are assignable to them
const _plainAsBare: StrDeviceAttribute = plain;
const _uninitializedAsUninitialized: StrDeviceAttribute<Uninitialized> = uninitialized;
const _nullableAsNullable: StrDeviceAttribute<Nullable> = nullable;

// @ts-expect-error a nullable attribute is not assignable to a plain (Initialized) attribute
const badPlain: StrDeviceAttribute = nullable;
// @ts-expect-error an uninitialized attribute is not assignable to a Nullable attribute
const badNullable: StrDeviceAttribute<Nullable> = uninitialized;
