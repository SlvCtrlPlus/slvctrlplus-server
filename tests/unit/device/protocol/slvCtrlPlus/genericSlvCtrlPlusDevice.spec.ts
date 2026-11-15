import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { Type } from '@sinclair/typebox';
import GenericSlvCtrlPlusDevice from '../../../../../src/device/protocol/slvCtrlPlus/genericSlvCtrlPlusDevice.js';
import { boolProperty, strProperty } from '../../../../../src/device/attribute/attributeSchema.js';
import SlvCtrlProtocol from '../../../../../src/device/protocol/slvCtrlPlus/slvCtrlProtocol.js';
import DeviceBidirectionalTransport from '../../../../../src/device/transport/deviceBidirectionalTransport.js';
import { matchStrictlyEqual } from '../../../helper/matchers.js';
import Logger from '../../../../../src/logging/Logger.js';
import EventEmitter from 'events';
import { DeviceId } from '../../../../../src/device/deviceId.js';
import type JsonSchemaValidatorFactory from '../../../../../src/schemaValidation/JsonSchemaValidatorFactory.js';
import type JsonSchemaValidator from '../../../../../src/schemaValidation/JsonSchemaValidator.js';
import type { DeviceAttributeValues } from '../../../../../src/device/device.js';
import type { TSchema } from '@sinclair/typebox';

function createMockValidatorFactory(): JsonSchemaValidatorFactory {
    const mockValidator = mock<JsonSchemaValidator<TSchema>>();
    mockValidator.validate.mockReturnValue(true);
    mockValidator.getValidationErrors.mockReturnValue([]);

    const factory = mock<JsonSchemaValidatorFactory>();
    factory.create.mockReturnValue(mockValidator);

    return factory;
}

describe('GenericSlvCtrlPlusDevice', () => {

    function createDevice(
        schema: TSchema,
        data: DeviceAttributeValues,
        protocol: SlvCtrlProtocol,
        transport: DeviceBidirectionalTransport,
    ): GenericSlvCtrlPlusDevice {
        const fwVersion = 10000;
        const deviceUuid = DeviceId.create('foo-bar-baz');
        const deviceName = 'Aston Martin';
        const model = 'et312';
        const protocolVersion = 10000;
        const provider = 'dummy';

        return new GenericSlvCtrlPlusDevice(
            {
                deviceId: deviceUuid,
                deviceName,
                provider,
                connectedSince: new Date(),
                controllable: true,
            },
            fwVersion,
            model,
            protocol,
            transport,
            protocolVersion,
            schema,
            data,
            createMockValidatorFactory(),
            mock<EventEmitter>(),
            mock<Logger>(),
        );
    }

    it('returns error for non-existing attribute in update', async () => {

        // Arrange
        const mockProtocol = mock<SlvCtrlProtocol>();
        const mockTransport = mock<DeviceBidirectionalTransport>();
        const schema = Type.Object({});
        const device = createDevice(schema, {}, mockProtocol, mockTransport);

        // Act — send update with unknown key; applyDeviceData sends 'set' and
        // the transport will throw because no mock expectation is set up
        const result = await device.updateDeviceData({ nonExistent: false });

        // Assert — the key is attempted but transport throws (no mock), producing an error
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it.each([
        { name: 'bool', schema: boolProperty({ label: 'Bool' }), valueToSet: false, protocolValue: '0' },
        { name: 'str', schema: strProperty({ label: 'String' }), valueToSet: 'foo', protocolValue: 'foo' },
    ])('sets value for $name attribute successfully', async ({ name, schema, valueToSet, protocolValue }) => {
        // Arrange
        const mockProtocol = mock<SlvCtrlProtocol>();
        const mockTransport = mock<DeviceBidirectionalTransport>();

        const command = { command: 'set', args: [name, valueToSet] };
        const rawProtocolCommand = `set ${name} ${protocolValue}`;
        const rawProtocolResponse = `set ${name} ${protocolValue};;status:ok`;

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
                    command: `set ${name} ${protocolValue}`,
                    data: { value: protocolValue },
                    result: {
                        status: 'ok',
                    }
                }
            });

        const deviceSchema = Type.Object({ [name]: schema });
        const device = createDevice(deviceSchema, { [name]: undefined }, mockProtocol, mockTransport);

        // Act
        const result = await device.updateDeviceData({ [name]: valueToSet });

        // Assert
        expect(result.errors).toHaveLength(0);
        const data = device.getDeviceData();
        expect(data[name]).toStrictEqual(valueToSet === false ? false : protocolValue);
    });

    it('fails to set attribute: device reports the command as failed', async () => {

        // Arrange
        const attrName = 'bool';
        const exceptionMessage = 'task timed out (>175ms)';
        const command = { command: 'set', args: [attrName, true] };
        const rawProtocolCommand = `set ${attrName} 1\n`;

        const mockProtocol = mock<SlvCtrlProtocol>();
        const mockTransport = mock<DeviceBidirectionalTransport>();

        mockProtocol.encode
            .calledWith(matchStrictlyEqual(command))
            .mockReturnValue(Buffer.from(rawProtocolCommand));
        mockTransport.sendAndAwaitReceive
            .calledWith(matchStrictlyEqual(Buffer.from(rawProtocolCommand)))
            .mockRejectedValue(new Error(exceptionMessage));

        const schema = Type.Object({ [attrName]: boolProperty({ label: 'Bool' }) });
        const device = createDevice(schema, { [attrName]: undefined }, mockProtocol, mockTransport);

        // Act
        const result = await device.updateDeviceData({ [attrName]: true });

        // Assert — error is collected rather than thrown
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.message).toBe(exceptionMessage);
    });

    it('updates attribute values on refresh', async () => {

        // Arrange
        const mockProtocol = mock<SlvCtrlProtocol>();
        const mockTransport = mock<DeviceBidirectionalTransport>();
        const mockLogger = mock<Logger>();

        const schema = Type.Object({
            bool: boolProperty({ label: 'Bool' }),
            str: strProperty({ label: 'Str' }),
        });

        const device = new GenericSlvCtrlPlusDevice(
            {
                deviceId: DeviceId.create('device-id'),
                deviceName: 'Device',
                provider: 'provider',
                connectedSince: new Date(),
                controllable: true,
            },
            10000,
            'model',
            mockProtocol,
            mockTransport,
            10000,
            schema,
            { bool: undefined, str: undefined },
            createMockValidatorFactory(),
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
        const data = device.getDeviceData();
        expect(data.bool).toStrictEqual(true);
        expect(data.str).toStrictEqual('hello');
    });

    it('sets attribute value to undefined when response data value is empty string', async () => {

        // Arrange
        const mockProtocol = mock<SlvCtrlProtocol>();
        const mockTransport = mock<DeviceBidirectionalTransport>();

        const schema = Type.Object({
            bool: boolProperty({ label: 'Bool' }),
        });
        const device = createDevice(schema, { bool: true }, mockProtocol, mockTransport);

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
        const data = device.getDeviceData();
        expect(data.bool).toBeUndefined();
    });

    it('ignores unknown attributes in refresh response', async () => {

        // Arrange
        const mockProtocol = mock<SlvCtrlProtocol>();
        const mockTransport = mock<DeviceBidirectionalTransport>();

        const schema = Type.Object({
            bool: boolProperty({ label: 'Bool' }),
        });
        const device = createDevice(schema, { bool: undefined }, mockProtocol, mockTransport);

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
        const data = device.getDeviceData();
        expect(data.bool).toStrictEqual(true);
    });
})
