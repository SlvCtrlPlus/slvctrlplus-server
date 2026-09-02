import { expectTypeOf } from 'vitest';
import FloatDeviceAttribute from '../../../src/device/attribute/floatDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../../src/device/attribute/deviceAttribute.js';
import type { Nullable, Uninitialized } from '../../../src/device/attribute/deviceAttribute.js';
import { Float } from '../../../src/util/numbers.js';

// plain create(): value always present, no null/undefined
const plain = FloatDeviceAttribute.create({ name: 'foo', label: 'Foo', modifier: DeviceAttributeModifier.readWrite, initialValue: Float.from(1.5) });
expectTypeOf(plain.value).toEqualTypeOf<Float>();

// uninitialized: true - value may be undefined (only assignable at construction)
const uninitialized = FloatDeviceAttribute.create({ name: 'foo', modifier: DeviceAttributeModifier.readWrite, uninitialized: true, initialValue: undefined });
expectTypeOf(uninitialized.value).toEqualTypeOf<Float | undefined>();

// nullable: true - value may be null (assignable at any time)
const nullable = FloatDeviceAttribute.create({ name: 'foo', modifier: DeviceAttributeModifier.readWrite, nullable: true, initialValue: null });
expectTypeOf(nullable.value).toEqualTypeOf<Float | null>();

// @ts-expect-error a non-nullable, non-uninitialized attribute cannot be constructed with null
FloatDeviceAttribute.create({ name: 'foo', modifier: DeviceAttributeModifier.readWrite, initialValue: null });

// create() collapses to the canonical presence markers, so results are assignable to them
const _plainAsBare: FloatDeviceAttribute = plain;
const _uninitializedAsUninitialized: FloatDeviceAttribute<Uninitialized> = uninitialized;
const _nullableAsNullable: FloatDeviceAttribute<Nullable> = nullable;

// @ts-expect-error a nullable attribute is not assignable to a plain (Initialized) attribute
const badPlain: FloatDeviceAttribute = nullable;
// @ts-expect-error an uninitialized attribute is not assignable to a Nullable attribute
const badNullable: FloatDeviceAttribute<Nullable> = uninitialized;
