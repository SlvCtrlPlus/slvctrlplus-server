import {describe, it, expect} from "vitest";
import ListDeviceAttribute from '../../../../src/device/attribute/listDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../../../src/device/attribute/deviceAttribute.js';
import { Int } from '../../../../src/util/numbers.js';

describe('ListDeviceAttribute', () => {

    it('correctly parses value from string if key is string', async () => {

        // Arrange
        const attribute = ListDeviceAttribute.create<string, string>(
            'attrName',
            undefined,
            DeviceAttributeModifier.readWrite,
            new Map<string, string>([['1', '1']])
        );
        
        // Act
        const valueFromStr = attribute.fromString('1');
        
        // Assert
        expect(valueFromStr).not.toStrictEqual(1);
        expect(valueFromStr).toStrictEqual('1');
    });

    it('correctly parses value from string if key is Int', async () => {

        // Arrange
        const attribute = ListDeviceAttribute.create<Int, string>(
            'attrName',
            undefined,
            DeviceAttributeModifier.readWrite,
            new Map<Int, string>([[Int.from(1), '1']])
        );

        // Act
        const valueFromStr = attribute.fromString('1');

        // Assert
        expect(valueFromStr).not.toStrictEqual('1');
        expect(valueFromStr).toStrictEqual(1);
    });

    it('returns true if value is a valid option', async () => {

        // Arrange
        const attribute = ListDeviceAttribute.create<Int, string>(
            'attrName',
            undefined,
            DeviceAttributeModifier.readWrite,
            new Map<Int, string>([[Int.from(1), '1']])
        );

        // Act
        const validValue = attribute.isValidValue(1);

        // Assert
        expect(validValue).toStrictEqual(true);
    });

    it('returns false if value is not a valid option', async () => {

        // Arrange
        const attribute = ListDeviceAttribute.create<Int, string>(
            'attrName',
            undefined,
            DeviceAttributeModifier.readWrite,
            new Map<Int, string>([[Int.from(1), '1']])
        );

        // Act
        const validValue = attribute.isValidValue(2);

        // Assert
        expect(validValue).toStrictEqual(false);
    });
});
