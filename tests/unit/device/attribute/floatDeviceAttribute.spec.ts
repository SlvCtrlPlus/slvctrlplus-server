import { describe, it, expect } from 'vitest';
import FloatDeviceAttribute from '../../../../src/device/attribute/floatDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../../../src/device/attribute/deviceAttribute.js';

describe('FloatDeviceAttribute', () => {

    const attribute = FloatDeviceAttribute.create('attrName', undefined, DeviceAttributeModifier.readWrite, undefined);

    it.each([
        { value: 5.5, expected: true },
        { value: 0, expected: true },
        { value: -5.5, expected: true },
        { value: NaN, expected: false },
        { value: Infinity, expected: false },
        { value: -Infinity, expected: false },
        { value: '5.5', expected: false },
        { value: true, expected: false },
    ])('returns $expected for isValidValue($value)', ({ value, expected }) => {
        expect(attribute.isValidValue(value)).toStrictEqual(expected);
    });
});
