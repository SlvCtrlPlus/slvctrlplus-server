import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { TSchema } from '@sinclair/typebox';
import EStim2bDevice from '../../../../../src/device/protocol/estim2b/estim2bDevice.js';
import EStim2bProtocol, { EStim2bMode, EStim2bStatus } from '../../../../../src/device/protocol/estim2b/estim2bProtocol.js';
import DeviceBidirectionalTransport from '../../../../../src/device/transport/deviceBidirectionalTransport.js';
import { DeviceId } from '../../../../../src/device/deviceId.js';
import Logger from '../../../../../src/logging/Logger.js';
import EventEmitter from 'events';
import { estim2bAttributesSchema, getPulseConfigForMode } from '../../../../../src/device/protocol/estim2b/estim2bAttributesSchema.js';
import type { EStim2bAttributeValues } from '../../../../../src/device/protocol/estim2b/estim2bAttributesSchema.js';
import type JsonSchemaValidatorFactory from '../../../../../src/schemaValidation/JsonSchemaValidatorFactory.js';
import type JsonSchemaValidator from '../../../../../src/schemaValidation/JsonSchemaValidator.js';

function createMockValidatorFactory(): JsonSchemaValidatorFactory {
    const mockValidator = mock<JsonSchemaValidator<TSchema>>();
    mockValidator.validate.mockReturnValue(true);
    mockValidator.getValidationErrors.mockReturnValue([]);
    const factory = mock<JsonSchemaValidatorFactory>();
    factory.create.mockReturnValue(mockValidator);
    return factory;
}

describe('EStim2bDevice', () => {

    function createStatus(overrides: Partial<EStim2bStatus> = {}): EStim2bStatus {
        return {
            batteryLevel: 600,
            channelALevel: 20,
            channelBLevel: 10,
            pulseFrequency: 50,
            pulsePwm: 50,
            currentMode: EStim2bMode.pulse,
            powerMode: 'L',
            channelsJoined: false,
            firmwareVersion: '1.0.0',
            ...overrides,
        };
    }

    function createAttributes(mode: EStim2bMode = EStim2bMode.pulse): EStim2bAttributeValues {
        const pulseConfig = getPulseConfigForMode(mode);
        return {
            mode: mode,
            channelALevel: 0,
            channelBLevel: 0,
            ...(pulseConfig !== undefined ? { pulseFrequency: 0 } : {}),
            ...(pulseConfig?.pulsePwmLabel !== undefined ? { pulsePwm: 0 } : {}),
            channelsJoined: false,
            highPowerMode: false,
            batteryStatus: '',
        };
    }

    function createDevice(
        status: EStim2bStatus,
        protocol: EStim2bProtocol,
        transport: DeviceBidirectionalTransport,
    ): EStim2bDevice {
        const pulseConfig = getPulseConfigForMode(status.currentMode);
        const schema = estim2bAttributesSchema(pulseConfig ?? undefined);
        return new EStim2bDevice(
            {
                deviceId: DeviceId.create('device-id'),
                deviceName: 'ET-312',
                provider: 'estim2b',
                connectedSince: new Date(),
                controllable: true,
            },
            status,
            protocol,
            transport,
            schema,
            createAttributes(status.currentMode),
            createMockValidatorFactory(),
            new EventEmitter(),
            mock<Logger>(),
        );
    }

    describe('humanReadableBatteryLevel', () => {

        it.each([
            { adc: 721, expected: 'mains' },
            { adc: 600, expected: 'full' },
            { adc: 535, expected: 'medium' },
            { adc: 510, expected: 'low' },
            { adc: 500, expected: 'critical' },
        ])('returns $expected for ADC value $adc', ({ adc, expected }) => {
            expect(EStim2bDevice.humanReadableBatteryLevel(adc)).toStrictEqual(expected);
        });
    });

    it('sets mode and updates attributes', async () => {
        const mockProtocol = mock<EStim2bProtocol>();
        const mockTransport = mock<DeviceBidirectionalTransport>();
        const initialStatus = createStatus({ currentMode: EStim2bMode.pulse });
        const responseStatus = createStatus({ currentMode: EStim2bMode.bounce });
        const encodedCommand = Buffer.from('M1');
        const responseBuffer = Buffer.from('response');

        mockProtocol.createSetModeCommand.mockReturnValue(`M${EStim2bMode.bounce}`);
        mockProtocol.encode.mockReturnValue(encodedCommand);
        mockTransport.sendAndAwaitReceive.mockResolvedValue(responseBuffer);
        mockProtocol.decode.mockReturnValue({ message: responseStatus });

        const device = createDevice(initialStatus, mockProtocol, mockTransport);

        await device.updateDeviceData({ mode: EStim2bMode.bounce });

        expect(mockProtocol.createSetModeCommand).toHaveBeenCalledWith(EStim2bMode.bounce);
        expect(mockProtocol.encode).toHaveBeenCalledWith(`M${EStim2bMode.bounce}`);
        expect(mockTransport.sendAndAwaitReceive).toHaveBeenCalledWith(encodedCommand, 250);
        expect(mockProtocol.decode).toHaveBeenCalledWith(responseBuffer);
        expect(device.getDeviceData().mode).toStrictEqual(EStim2bMode.bounce);
    });

    it('sets channel A level and updates attributes', async () => {
        const mockProtocol = mock<EStim2bProtocol>();
        const mockTransport = mock<DeviceBidirectionalTransport>();
        const initialStatus = createStatus();
        const responseStatus = createStatus({ channelALevel: 50 });
        const encodedCommand = Buffer.from('A50');
        const responseBuffer = Buffer.from('response');

        mockProtocol.createSetPowerCommand.mockReturnValue('A50');
        mockProtocol.encode.mockReturnValue(encodedCommand);
        mockTransport.sendAndAwaitReceive.mockResolvedValue(responseBuffer);
        mockProtocol.decode.mockReturnValue({ message: responseStatus });

        const device = createDevice(initialStatus, mockProtocol, mockTransport);

        await device.updateDeviceData({ channelALevel: 50 });

        expect(mockProtocol.createSetPowerCommand).toHaveBeenCalledWith('A', 50);
        expect(mockTransport.sendAndAwaitReceive).toHaveBeenCalledWith(encodedCommand, 250);
        expect(device.getDeviceData().channelALevel).toStrictEqual(50);
    });

    it('sets channel B level and updates attributes', async () => {
        const mockProtocol = mock<EStim2bProtocol>();
        const mockTransport = mock<DeviceBidirectionalTransport>();
        const initialStatus = createStatus();
        const responseStatus = createStatus({ channelBLevel: 30 });
        const encodedCommand = Buffer.from('B30');
        const responseBuffer = Buffer.from('response');

        mockProtocol.createSetPowerCommand.mockReturnValue('B30');
        mockProtocol.encode.mockReturnValue(encodedCommand);
        mockTransport.sendAndAwaitReceive.mockResolvedValue(responseBuffer);
        mockProtocol.decode.mockReturnValue({ message: responseStatus });

        const device = createDevice(initialStatus, mockProtocol, mockTransport);

        await device.updateDeviceData({ channelBLevel: 30 });

        expect(mockProtocol.createSetPowerCommand).toHaveBeenCalledWith('B', 30);
        expect(mockTransport.sendAndAwaitReceive).toHaveBeenCalledWith(encodedCommand, 250);
        expect(device.getDeviceData().channelBLevel).toStrictEqual(30);
    });

    it('sets pulse frequency and updates attributes', async () => {
        const mockProtocol = mock<EStim2bProtocol>();
        const mockTransport = mock<DeviceBidirectionalTransport>();
        const initialStatus = createStatus({ currentMode: EStim2bMode.pulse });
        const responseStatus = createStatus({ currentMode: EStim2bMode.pulse, pulseFrequency: 75 });
        const encodedCommand = Buffer.from('C75');
        const responseBuffer = Buffer.from('response');

        mockProtocol.createSetPulseFrequencyCommand.mockReturnValue('C75');
        mockProtocol.encode.mockReturnValue(encodedCommand);
        mockTransport.sendAndAwaitReceive.mockResolvedValue(responseBuffer);
        mockProtocol.decode.mockReturnValue({ message: responseStatus });

        const device = createDevice(initialStatus, mockProtocol, mockTransport);

        await device.updateDeviceData({ pulseFrequency: 75 });

        expect(mockProtocol.createSetPulseFrequencyCommand).toHaveBeenCalledWith(75);
        expect(mockTransport.sendAndAwaitReceive).toHaveBeenCalledWith(encodedCommand, 250);
        expect(device.getDeviceData().pulseFrequency).toStrictEqual(75);
    });

    it('sets pulse PWM and updates attributes', async () => {
        const mockProtocol = mock<EStim2bProtocol>();
        const mockTransport = mock<DeviceBidirectionalTransport>();
        const initialStatus = createStatus({ currentMode: EStim2bMode.pulse });
        const responseStatus = createStatus({ currentMode: EStim2bMode.pulse, pulsePwm: 25 });
        const encodedCommand = Buffer.from('D25');
        const responseBuffer = Buffer.from('response');

        mockProtocol.createSetPulsePwmCommand.mockReturnValue('D25');
        mockProtocol.encode.mockReturnValue(encodedCommand);
        mockTransport.sendAndAwaitReceive.mockResolvedValue(responseBuffer);
        mockProtocol.decode.mockReturnValue({ message: responseStatus });

        const device = createDevice(initialStatus, mockProtocol, mockTransport);

        await device.updateDeviceData({ pulsePwm: 25 });

        expect(mockProtocol.createSetPulsePwmCommand).toHaveBeenCalledWith(25);
        expect(mockTransport.sendAndAwaitReceive).toHaveBeenCalledWith(encodedCommand, 250);
        expect(device.getDeviceData().pulsePwm).toStrictEqual(25);
    });

    it('sets high power mode to high', async () => {
        const mockProtocol = mock<EStim2bProtocol>();
        const mockTransport = mock<DeviceBidirectionalTransport>();
        const initialStatus = createStatus({ powerMode: 'L' });
        const responseStatus = createStatus({ powerMode: 'H' });
        const encodedCommand = Buffer.from('H');
        const responseBuffer = Buffer.from('response');

        mockProtocol.createSetPowerModeCommand.mockReturnValue('H');
        mockProtocol.encode.mockReturnValue(encodedCommand);
        mockTransport.sendAndAwaitReceive.mockResolvedValue(responseBuffer);
        mockProtocol.decode.mockReturnValue({ message: responseStatus });

        const device = createDevice(initialStatus, mockProtocol, mockTransport);

        await device.updateDeviceData({ highPowerMode: true });

        expect(mockProtocol.createSetPowerModeCommand).toHaveBeenCalledWith('H');
        expect(mockTransport.sendAndAwaitReceive).toHaveBeenCalledWith(encodedCommand, 250);
        expect(device.getDeviceData().highPowerMode).toStrictEqual(true);
    });

    it('sets high power mode to low', async () => {
        const mockProtocol = mock<EStim2bProtocol>();
        const mockTransport = mock<DeviceBidirectionalTransport>();
        const initialStatus = createStatus({ powerMode: 'H' });
        const responseStatus = createStatus({ powerMode: 'L' });
        const encodedCommand = Buffer.from('L');
        const responseBuffer = Buffer.from('response');

        mockProtocol.createSetPowerModeCommand.mockReturnValue('L');
        mockProtocol.encode.mockReturnValue(encodedCommand);
        mockTransport.sendAndAwaitReceive.mockResolvedValue(responseBuffer);
        mockProtocol.decode.mockReturnValue({ message: responseStatus });

        const device = createDevice(initialStatus, mockProtocol, mockTransport);

        await device.updateDeviceData({ highPowerMode: false });

        expect(mockProtocol.createSetPowerModeCommand).toHaveBeenCalledWith('L');
        expect(mockTransport.sendAndAwaitReceive).toHaveBeenCalledWith(encodedCommand, 250);
        expect(device.getDeviceData().highPowerMode).toStrictEqual(false);
    });

    it('propagates transport errors', async () => {
        const mockProtocol = mock<EStim2bProtocol>();
        const mockTransport = mock<DeviceBidirectionalTransport>();
        const errorMessage = 'Connection lost';

        mockProtocol.createSetPowerCommand.mockReturnValue('A50');
        mockProtocol.encode.mockReturnValue(Buffer.from('A50'));
        mockTransport.sendAndAwaitReceive.mockRejectedValue(new Error(errorMessage));

        const device = createDevice(createStatus(), mockProtocol, mockTransport);

        const result = await device.updateDeviceData({ channelALevel: 50 });

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.message).toBe(errorMessage);
    });

    it('collects error when protocol decode returns an error', async () => {
        const mockProtocol = mock<EStim2bProtocol>();
        const mockTransport = mock<DeviceBidirectionalTransport>();
        const responseBuffer = Buffer.from('bad response');

        mockProtocol.createSetPowerCommand.mockReturnValue('A50');
        mockProtocol.encode.mockReturnValue(Buffer.from('A50'));
        mockTransport.sendAndAwaitReceive.mockResolvedValue(responseBuffer);
        mockProtocol.decode.mockReturnValue({ error: { type: 'invalid_frame', reason: 'unexpected byte' } });

        const device = createDevice(createStatus(), mockProtocol, mockTransport);

        const result = await device.updateDeviceData({ channelALevel: 50 });

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.message).toContain('unexpected byte');
    });

    it('updates attribute values on refresh', async () => {
        const mockProtocol = mock<EStim2bProtocol>();
        const mockTransport = mock<DeviceBidirectionalTransport>();
        const initialStatus = createStatus();
        const refreshedStatus = createStatus({
            channelALevel: 75,
            channelBLevel: 40,
            pulseFrequency: 80,
            pulsePwm: 30,
            powerMode: 'H',
            channelsJoined: true,
            batteryLevel: 510,
        });
        const encodedCommand = Buffer.from('');
        const responseBuffer = Buffer.from('response');

        mockProtocol.createGetStatusCommand.mockReturnValue('');
        mockProtocol.encode.mockReturnValue(encodedCommand);
        mockTransport.sendAndAwaitReceive.mockResolvedValue(responseBuffer);
        mockProtocol.decode.mockReturnValue({ message: refreshedStatus });

        const device = createDevice(initialStatus, mockProtocol, mockTransport);

        await device.refresh();

        expect(mockProtocol.createGetStatusCommand).toHaveBeenCalled();
        expect(mockTransport.sendAndAwaitReceive).toHaveBeenCalledWith(encodedCommand, 250);

        const data = device.getDeviceData();
        expect(data.channelALevel).toStrictEqual(75);
        expect(data.channelBLevel).toStrictEqual(40);
        expect(data.pulseFrequency).toStrictEqual(80);
        expect(data.pulsePwm).toStrictEqual(30);
        expect(data.highPowerMode).toStrictEqual(true);
        expect(data.channelsJoined).toStrictEqual(true);
        expect(data.batteryStatus).toStrictEqual('low');
    });
});
