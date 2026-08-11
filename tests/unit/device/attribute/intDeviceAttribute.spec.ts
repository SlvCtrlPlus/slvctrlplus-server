import { describe, it, expect } from 'vitest';
import IntDeviceAttribute from '../../../../src/device/attribute/intDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../../../src/device/attribute/deviceAttribute.js';

describe('IntDeviceAttribute', () => {

    const attribute = IntDeviceAttribute.create('attrName', undefined, DeviceAttributeModifier.readWrite, undefined);

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
