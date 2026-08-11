import { describe, it, expect } from 'vitest';
import IntRangeDeviceAttribute from '../../../../src/device/attribute/intRangeDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../../../src/device/attribute/deviceAttribute.js';
import { Int } from '../../../../src/util/numbers.js';

describe('IntRangeDeviceAttribute', () => {

    const attribute = IntRangeDeviceAttribute.create(
        'attrName',
        undefined,
        DeviceAttributeModifier.readWrite,
        undefined,
        Int.ZERO,
        Int.from(100),
        Int.from(1),
    );

    it.each([
        { value: 5, expected: true },
        { value: 0, expected: true },
        { value: -5, expected: true },
        { value: 1.5, expected: false },
        { value: NaN, expected: false },
        { value: Infinity, expected: false },
        { value: -Infinity, expected: false },
        { value: '5', expected: false },
        { value: true, expected: false },
    ])('returns $expected for isValidValue($value)', ({ value, expected }) => {
        expect(attribute.isValidValue(value)).toStrictEqual(expected);
    });
});
