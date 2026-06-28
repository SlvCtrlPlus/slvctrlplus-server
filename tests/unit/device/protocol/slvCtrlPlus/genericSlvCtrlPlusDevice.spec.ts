import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import GenericSlvCtrlPlusDevice from '../../../../../src/device/protocol/slvCtrlPlus/genericSlvCtrlPlusDevice.js';
import { SlvCtrlPlusDeviceAttributes } from '../../../../../src/device/protocol/slvCtrlPlus/slvCtrlPlusDevice.js';
import BoolDeviceAttribute from '../../../../../src/device/attribute/boolDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../../../../src/device/attribute/deviceAttribute.js';
import SlvCtrlProtocol from '../../../../../src/device/protocol/slvCtrlPlus/slvCtrlProtocol.js';
import StrDeviceAttribute from '../../../../../src/device/attribute/strDeviceAttribute.js';
import DeviceWritableTransport from '../../../../../src/device/transport/deviceWritableTransport.js';
import { matchStrictlyEqual } from '../../../helper/matchers.js';
import Logger from '../../../../../src/logging/Logger.js';
import EventEmitter from 'events';
import { DeviceId } from '../../../../../src/device/deviceId.js';

describe('GenericSlvCtrlPlusDevice', () => {

    function createDevice(
        attrs: SlvCtrlPlusDeviceAttributes,
        protocol: SlvCtrlProtocol,
        transport: DeviceWritableTransport,
    ): GenericSlvCtrlPlusDevice {
        const fwVersion = 10000;
        const deviceUuid = DeviceId.create('foo-bar-baz');
        const deviceName = 'Aston Martin';
        const model = 'et312';
        const protocolVersion = 10000;
        const provider = 'dummy';

        return new GenericSlvCtrlPlusDevice(
            fwVersion, deviceUuid, deviceName, model, provider, new Date(), protocol, transport, protocolVersion, attrs,
            mock<EventEmitter>(), mock<Logger>(),
        );
    }

    type Command = { command: string, args: string[] }

    class MyClass {
        public encode(command: Command): string {
            return `${command.command} ${command.args.join(' ')}`;
        }
    }

    class MyOtherClass {
        private readonly myClass: MyClass;
        constructor(myClass: MyClass) {
            this.myClass = myClass;
        }

        public test(): string {
            return this.myClass.encode({ command: 'write', args: ['hello', 'world'] });
        }
    }

    it('it throws an error if non-existing attribute is set', async () => {

        // Arrange
        const mockProtocol = mock<SlvCtrlProtocol>();
        const mockTransport = mock<DeviceWritableTransport>();
        const attrName = 'bool';
        const device = createDevice({}, mockProtocol, mockTransport);

        // Act
        const result = device.setAttribute(attrName, false);

        // Assert
        expect(mockTransport.sendAndAwaitReceive).not.toHaveBeenCalled();
        expect(mockProtocol.encode).not.toHaveBeenCalled();
        await expect(result).rejects.toThrow(`Attribute with name '${attrName}' does not exist for this device`);
    });

    it.each([
        { attribute: new BoolDeviceAttribute('bool', 'Bool', DeviceAttributeModifier.readWrite, undefined), valueToSet: false, protocolValue: '0' },
        { attribute: new StrDeviceAttribute('str', 'String', DeviceAttributeModifier.readWrite, undefined), valueToSet: 'foo', protocolValue: 'foo' },
    ])('it sets value for $attribute.constructor.name successfully', async ({ attribute, valueToSet, protocolValue }) => {
        // Arrange
        const mockProtocol = mock<SlvCtrlProtocol>();
        const mockTransport = mock<DeviceWritableTransport>();

        const command = { command: 'set', args: [attribute.name, valueToSet] };
        const rawProtocolCommand = `set ${attribute.name} ${protocolValue}`;
        const rawProtocolResponse = `set ${attribute.name} ${protocolValue};;status:ok`;

        mockProtocol.encode
            .calledWith(matchStrictlyEqual(command))
            .mockReturnValue(Buffer.from(rawProtocolCommand));
        mockTransport.sendAndAwaitReceive
            .calledWith(matchStrictlyEqual(Buffer.from(rawProtocolCommand)))
            .mockResolvedValue(Buffer.from(rawProtocolResponse));
        mockProtocol.decode
            .calledWith(matchStrictlyEqual(Buffer.from(rawProtocolResponse)))
            .mockReturnValue({
                message: {
                    command: `set ${attribute.name} ${protocolValue}`,
                    data: { value: protocolValue },
                    result: {
                        status: 'ok',
                    }
                }
            });

        const device = createDevice({
            [attribute.name]: attribute
        }, mockProtocol, mockTransport);

        // Act
        const result = device.setAttribute(attribute.name, valueToSet);

        // Assert
        await expect(result).resolves.toStrictEqual(valueToSet);
    });

    it('it fails to set attribute: device reports the command as failed', async () => {

        // Arrange
        const attrName = 'bool';
        const exceptionMessage = 'task timed out (>175ms)';
        const command = { command: 'set', args: [attrName, true] };
        const rawProtocolCommand = `set ${attrName} 1\n`;

        const mockProtocol = mock<SlvCtrlProtocol>();
        const mockTransport = mock<DeviceWritableTransport>();

        mockProtocol.encode
            .calledWith(matchStrictlyEqual(command))
            .mockReturnValue(Buffer.from(rawProtocolCommand));
        mockTransport.sendAndAwaitReceive
            .calledWith(matchStrictlyEqual(Buffer.from(rawProtocolCommand)))
            .mockRejectedValue(new Error(exceptionMessage));

        const device = createDevice({
            [attrName]: new BoolDeviceAttribute(attrName, 'Bool', DeviceAttributeModifier.readWrite, undefined)
        }, mockProtocol, mockTransport);

        // Act
        const result = device.setAttribute(attrName, true);

        // Assert
        await expect(result).rejects.toThrow(exceptionMessage);
        expect(mockProtocol.decode).not.toBeCalled();
    });

    it.each([
        [undefined],
        [null],
    ])('it fails to set attribute: trying to set null or undefined', async (value) => {

        // Arrange
        const mockProtocol = mock<SlvCtrlProtocol>();
        const mockTransport = mock<DeviceWritableTransport>();

        const attrName = 'bool';
        const device = createDevice({
            [attrName]: new BoolDeviceAttribute(attrName, 'Bool', DeviceAttributeModifier.readWrite, undefined)
        }, mockProtocol, mockTransport);

        // Act
        const result = device.setAttribute(attrName, value);

        // Assert
        expect(mockProtocol.encode).not.toHaveBeenCalled();
        expect(mockTransport.sendAndAwaitReceive).not.toHaveBeenCalled();
        expect(mockProtocol.decode).not.toHaveBeenCalled();
        await expect(result).rejects.toThrow(`A non-null value must be set for the attribute with name '${attrName}'`);
    });

    it('it fails to set attribute: value is invalid for attribute type', async () => {

        // Arrange
        const mockProtocol = mock<SlvCtrlProtocol>();
        const mockTransport = mock<DeviceWritableTransport>();

        const attrName = 'bool';
        const device = createDevice(
            { [attrName]: new BoolDeviceAttribute(attrName, 'Bool', DeviceAttributeModifier.readWrite, undefined) },
            mockProtocol,
            mockTransport,
        );

        // Act
        const result = device.setAttribute(attrName, 'notABool');

        // Assert
        expect(mockProtocol.encode).not.toHaveBeenCalled();
        expect(mockTransport.sendAndAwaitReceive).not.toHaveBeenCalled();
        await expect(result).rejects.toThrow(`Value for attribute with name '${attrName}' is not valid.`);
    });

    it('it updates attribute values on refresh', async () => {

        // Arrange
        const mockProtocol = mock<SlvCtrlProtocol>();
        const mockTransport = mock<DeviceWritableTransport>();
        const mockLogger = mock<Logger>();

        const device = new GenericSlvCtrlPlusDevice(
            10000,
            DeviceId.create('device-id'),
            'Device',
            'model',
            'provider',
            new Date(),
            mockProtocol,
            mockTransport,
            10000,
            {
                bool: new BoolDeviceAttribute('bool', 'Bool', DeviceAttributeModifier.readWrite, undefined),
                str: new StrDeviceAttribute('str', 'Str', DeviceAttributeModifier.readWrite, undefined),
            },
            new EventEmitter(),
            mockLogger,
        );

        const statusCommand = { command: 'status', args: [] };
        const rawStatusCommand = 'status';
        const rawStatusResponse = 'status;;status:ok';

        mockProtocol.encode
            .calledWith(matchStrictlyEqual(statusCommand))
            .mockReturnValue(Buffer.from(rawStatusCommand));
        mockTransport.sendAndAwaitReceive
            .calledWith(matchStrictlyEqual(Buffer.from(rawStatusCommand)))
            .mockResolvedValue(Buffer.from(rawStatusResponse));
        mockProtocol.decode
            .calledWith(matchStrictlyEqual(Buffer.from(rawStatusResponse)))
            .mockReturnValue({
                message: {
                    command: rawStatusCommand,
                    data: { bool: '1', str: 'hello' },
                    result: { status: 'ok' },
                }
            });

        // Act
        await device.refresh();

        // Assert
        expect((await device.getAttribute('bool'))?.value).toStrictEqual(true);
        expect((await device.getAttribute('str'))?.value).toStrictEqual('hello');
    });

    it('it sets attribute value to undefined when response data value is empty string', async () => {

        // Arrange
        const mockProtocol = mock<SlvCtrlProtocol>();
        const mockTransport = mock<DeviceWritableTransport>();
        const mockLogger = mock<Logger>();

        const device = new GenericSlvCtrlPlusDevice(
            10000,
            DeviceId.create('device-id'),
            'Device',
            'model',
            'provider',
            new Date(),
            mockProtocol,
            mockTransport,
            10000,
            {
                bool: new BoolDeviceAttribute('bool', 'Bool', DeviceAttributeModifier.readWrite, true),
            },
            new EventEmitter(),
            mockLogger,
        );

        const statusCommand = { command: 'status', args: [] };
        const rawStatusCommand = 'status';
        const rawStatusResponse = 'status;;status:ok';

        mockProtocol.encode
            .calledWith(matchStrictlyEqual(statusCommand))
            .mockReturnValue(Buffer.from(rawStatusCommand));
        mockTransport.sendAndAwaitReceive
            .calledWith(matchStrictlyEqual(Buffer.from(rawStatusCommand)))
            .mockResolvedValue(Buffer.from(rawStatusResponse));
        mockProtocol.decode
            .calledWith(matchStrictlyEqual(Buffer.from(rawStatusResponse)))
            .mockReturnValue({
                message: {
                    command: rawStatusCommand,
                    data: { bool: '' },
                    result: { status: 'ok' },
                }
            });

        // Act
        await device.refresh();

        // Assert
        expect((await device.getAttribute('bool'))?.value).toBeUndefined();
    });

    it('it ignores unknown attributes in refresh response', async () => {

        // Arrange
        const mockProtocol = mock<SlvCtrlProtocol>();
        const mockTransport = mock<DeviceWritableTransport>();
        const mockLogger = mock<Logger>();

        const device = new GenericSlvCtrlPlusDevice(
            10000,
            DeviceId.create('device-id'),
            'Device',
            'model',
            'provider',
            new Date(),
            mockProtocol,
            mockTransport,
            10000,
            {
                bool: new BoolDeviceAttribute('bool', 'Bool', DeviceAttributeModifier.readWrite, undefined),
            },
            new EventEmitter(),
            mockLogger,
        );

        const statusCommand = { command: 'status', args: [] };
        const rawStatusCommand = 'status';
        const rawStatusResponse = 'status;;status:ok';

        mockProtocol.encode
            .calledWith(matchStrictlyEqual(statusCommand))
            .mockReturnValue(Buffer.from(rawStatusCommand));
        mockTransport.sendAndAwaitReceive
            .calledWith(matchStrictlyEqual(Buffer.from(rawStatusCommand)))
            .mockResolvedValue(Buffer.from(rawStatusResponse));
        mockProtocol.decode
            .calledWith(matchStrictlyEqual(Buffer.from(rawStatusResponse)))
            .mockReturnValue({
                message: {
                    command: rawStatusCommand,
                    data: { bool: '1', unknownAttr: 'something' },
                    result: { status: 'ok' },
                }
            });

        // Act & Assert - should not throw when encountering unknown attribute in response
        await expect(device.refresh()).resolves.not.toThrow();
        expect((await device.getAttribute('bool'))?.value).toStrictEqual(true);
    });
})