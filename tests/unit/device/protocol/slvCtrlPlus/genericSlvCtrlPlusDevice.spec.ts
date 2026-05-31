import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import GenericSlvCtrlPlusDevice from '../../../../../src/device/protocol/slvCtrlPlus/genericSlvCtrlPlusDevice.js';
import { SlvCtrlPlusDeviceAttributes } from '../../../../../src/device/protocol/slvCtrlPlus/slvCtrlPlusDevice.js';
import BoolDeviceAttribute from '../../../../../src/device/attribute/boolDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../../../../src/device/attribute/deviceAttribute.js';
import SlvCtrlProtocol from '../../../../../src/device/protocol/slvCtrlPlus/slvCtrlProtocol.js';
import StrDeviceAttribute from '../../../../../src/device/attribute/strDeviceAttribute.js';
import DeviceTransport from '../../../../../src/device/transport/deviceTransport.js';
import { matchStrictlyEqual } from '../../../helper/matchers.js';
import {EventEmitter} from 'events';
import Logger from '../../../../../src/logging/Logger.js';

describe('GenericSlvCtrlPlusDevice', () => {

    function createDevice(
        attrs: SlvCtrlPlusDeviceAttributes,
        protocol: SlvCtrlProtocol,
        transport: DeviceTransport,
    ): GenericSlvCtrlPlusDevice {
        const fwVersion = 10000;
        const deviceUuid = 'foo-bar-baz';
        const deviceName = 'Aston Martin';
        const model = 'et312';
        const protocolVersion = 10000;
        const provider = 'dummy';

        return new GenericSlvCtrlPlusDevice(
            fwVersion, deviceUuid, deviceName, model, provider, new Date(), protocol, transport, protocolVersion, attrs,
            new EventEmitter(), mock<Logger>()
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
        const mockTransport = mock<DeviceTransport>();
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
        const mockTransport = mock<DeviceTransport>();

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
        const mockTransport = mock<DeviceTransport>();

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
        const mockTransport = mock<DeviceTransport>();

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
})