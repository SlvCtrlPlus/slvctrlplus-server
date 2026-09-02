import { expectTypeOf } from 'vitest';
import BoolDeviceAttribute from '../../../src/device/attribute/boolDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../../src/device/attribute/deviceAttribute.js';
import type { Nullable, Uninitialized } from '../../../src/device/attribute/deviceAttribute.js';

// plain create(): value always present, no null/undefined
const plain = BoolDeviceAttribute.create({ name: 'foo', label: 'Foo', modifier: DeviceAttributeModifier.readWrite, initialValue: true });
expectTypeOf(plain.value).toEqualTypeOf<boolean>();

// uninitialized: true - value may be undefined (only assignable at construction)
const uninitialized = BoolDeviceAttribute.create({ name: 'foo', modifier: DeviceAttributeModifier.readWrite, uninitialized: true, initialValue: undefined });
expectTypeOf(uninitialized.value).toEqualTypeOf<boolean | undefined>();

// nullable: true - value may be null (assignable at any time)
const nullable = BoolDeviceAttribute.create({ name: 'foo', modifier: DeviceAttributeModifier.readWrite, nullable: true, initialValue: null });
expectTypeOf(nullable.value).toEqualTypeOf<boolean | null>();

// @ts-expect-error a non-nullable, non-uninitialized attribute cannot be constructed with null
BoolDeviceAttribute.create({ name: 'foo', modifier: DeviceAttributeModifier.readWrite, initialValue: null });

// @ts-expect-error a non-nullable, non-uninitialized attribute cannot be constructed with undefined
BoolDeviceAttribute.create({ name: 'foo', modifier: DeviceAttributeModifier.readWrite, initialValue: undefined });

// create() collapses to the canonical presence markers, so results are assignable to them
const _plainAsBare: BoolDeviceAttribute = plain;
const _uninitializedAsUninitialized: BoolDeviceAttribute<Uninitialized> = uninitialized;
const _nullableAsNullable: BoolDeviceAttribute<Nullable> = nullable;

// @ts-expect-error a nullable attribute is not assignable to a plain (Initialized) attribute
const badPlain: BoolDeviceAttribute = nullable;
// @ts-expect-error an uninitialized attribute is not assignable to a Nullable attribute
const badNullable: BoolDeviceAttribute<Nullable> = uninitialized;
