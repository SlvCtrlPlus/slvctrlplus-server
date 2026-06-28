import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import EStim2bDevice, { EStim2bDeviceAttributes } from '../../../../../src/device/protocol/estim2b/estim2bDevice.js';
import EStim2bProtocol, { EStim2bMode, EStim2bStatus } from '../../../../../src/device/protocol/estim2b/estim2bProtocol.js';
import DeviceWritableTransport from '../../../../../src/device/transport/deviceWritableTransport.js';
import IntRangeDeviceAttribute from '../../../../../src/device/attribute/intRangeDeviceAttribute.js';
import BoolDeviceAttribute from '../../../../../src/device/attribute/boolDeviceAttribute.js';
import StrDeviceAttribute from '../../../../../src/device/attribute/strDeviceAttribute.js';
import ListDeviceAttribute from '../../../../../src/device/attribute/listDeviceAttribute.js';
import { DeviceAttributeModifier } from '../../../../../src/device/attribute/deviceAttribute.js';
import { Int } from '../../../../../src/util/numbers.js';
import { DeviceId } from '../../../../../src/device/deviceId.js';
import Logger from '../../../../../src/logging/Logger.js';
import EventEmitter from 'events';

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

    function createAttributes(): EStim2bDeviceAttributes {
        const modeOptions = [
            { key: Int.from(EStim2bMode.pulse), value: 'Pulse' },
            { key: Int.from(EStim2bMode.bounce), value: 'Bounce' },
            { key: Int.from(EStim2bMode.continuous), value: 'Continuous' },
            { key: Int.from(EStim2bMode.aSplit), value: 'A-Split' },
            { key: Int.from(EStim2bMode.bSplit), value: 'B-Split' },
            { key: Int.from(EStim2bMode.wave), value: 'Wave' },
            { key: Int.from(EStim2bMode.waterfall), value: 'Waterfall' },
            { key: Int.from(EStim2bMode.squeeze), value: 'Squeeze' },
            { key: Int.from(EStim2bMode.milk), value: 'Milk' },
            { key: Int.from(EStim2bMode.throb), value: 'Throb' },
            { key: Int.from(EStim2bMode.thrust), value: 'Thrust' },
            { key: Int.from(EStim2bMode.random), value: 'Random' },
            { key: Int.from(EStim2bMode.step), value: 'Step' },
            { key: Int.from(EStim2bMode.training), value: 'Training' },
        ];

        return {
            mode: ListDeviceAttribute.create<Int, string>('mode', 'Mode', DeviceAttributeModifier.readWrite, modeOptions),
            channelALevel: IntRangeDeviceAttribute.create('channelALevel', 'Channel A', DeviceAttributeModifier.readWrite, undefined, Int.ZERO, Int.from(99), Int.from(1)),
            channelBLevel: IntRangeDeviceAttribute.create('channelBLevel', 'Channel B', DeviceAttributeModifier.readWrite, undefined, Int.ZERO, Int.from(99), Int.from(1)),
            channelsJoined: BoolDeviceAttribute.create('channelsJoined', 'Channels Joined', DeviceAttributeModifier.readOnly),
            highPowerMode: BoolDeviceAttribute.create('highPowerMode', 'High Power Mode', DeviceAttributeModifier.readWrite),
            batteryStatus: StrDeviceAttribute.create('batteryStatus', 'Battery', DeviceAttributeModifier.readOnly),
        };
    }

    function createDevice(
        status: EStim2bStatus,
        protocol: EStim2bProtocol,
        transport: DeviceWritableTransport,
    ): EStim2bDevice {
        return new EStim2bDevice(
            DeviceId.create('device-id'),
            'ET-312',
            'estim2b',
            new Date(),
            true,
            status,
            protocol,
            transport,
            createAttributes(),
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

    it('it sets mode and updates attributes', async () => {

        // Arrange
        const mockProtocol = mock<EStim2bProtocol>();
        const mockTransport = mock<DeviceWritableTransport>();
        const initialStatus = createStatus({ currentMode: EStim2bMode.pulse });
        const responseStatus = createStatus({ currentMode: EStim2bMode.bounce });
        const encodedCommand = Buffer.from('M1');
        const responseBuffer = Buffer.from('response');

        mockProtocol.createSetModeCommand.mockReturnValue(`M${EStim2bMode.bounce}`);
        mockProtocol.encode.mockReturnValue(encodedCommand);
        mockTransport.sendAndAwaitReceive.mockResolvedValue(responseBuffer);
        mockProtocol.decode.mockReturnValue({ message: responseStatus });

        const device = createDevice(initialStatus, mockProtocol, mockTransport);

        // Act
        await device.setAttribute('mode', Int.from(EStim2bMode.bounce));

        // Assert
        expect(mockProtocol.createSetModeCommand).toHaveBeenCalledWith(EStim2bMode.bounce);
        expect(mockProtocol.encode).toHaveBeenCalledWith(`M${EStim2bMode.bounce}`);
        expect(mockTransport.sendAndAwaitReceive).toHaveBeenCalledWith(encodedCommand, 250);
        expect(mockProtocol.decode).toHaveBeenCalledWith(responseBuffer);
        expect((await device.getAttribute('mode'))?.value).toStrictEqual(Int.from(EStim2bMode.bounce));
    });

    it('it sets channel A level and updates attributes', async () => {

        // Arrange
        const mockProtocol = mock<EStim2bProtocol>();
        const mockTransport = mock<DeviceWritableTransport>();
        const initialStatus = createStatus();
        const responseStatus = createStatus({ channelALevel: 50 });
        const encodedCommand = Buffer.from('A50');
        const responseBuffer = Buffer.from('response');

        mockProtocol.createSetPowerCommand.mockReturnValue('A50');
        mockProtocol.encode.mockReturnValue(encodedCommand);
        mockTransport.sendAndAwaitReceive.mockResolvedValue(responseBuffer);
        mockProtocol.decode.mockReturnValue({ message: responseStatus });

        const device = createDevice(initialStatus, mockProtocol, mockTransport);

        // Act
        await device.setAttribute('channelALevel', Int.from(50));

        // Assert
        expect(mockProtocol.createSetPowerCommand).toHaveBeenCalledWith('A', 50);
        expect(mockTransport.sendAndAwaitReceive).toHaveBeenCalledWith(encodedCommand, 250);
        expect((await device.getAttribute('channelALevel'))?.value).toStrictEqual(Int.from(50));
    });

    it('it sets channel B level and updates attributes', async () => {

        // Arrange
        const mockProtocol = mock<EStim2bProtocol>();
        const mockTransport = mock<DeviceWritableTransport>();
        const initialStatus = createStatus();
        const responseStatus = createStatus({ channelBLevel: 30 });
        const encodedCommand = Buffer.from('B30');
        const responseBuffer = Buffer.from('response');

        mockProtocol.createSetPowerCommand.mockReturnValue('B30');
        mockProtocol.encode.mockReturnValue(encodedCommand);
        mockTransport.sendAndAwaitReceive.mockResolvedValue(responseBuffer);
        mockProtocol.decode.mockReturnValue({ message: responseStatus });

        const device = createDevice(initialStatus, mockProtocol, mockTransport);

        // Act
        await device.setAttribute('channelBLevel', Int.from(30));

        // Assert
        expect(mockProtocol.createSetPowerCommand).toHaveBeenCalledWith('B', 30);
        expect(mockTransport.sendAndAwaitReceive).toHaveBeenCalledWith(encodedCommand, 250);
        expect((await device.getAttribute('channelBLevel'))?.value).toStrictEqual(Int.from(30));
    });

    it('it sets pulse frequency and updates attributes', async () => {

        // Arrange
        const mockProtocol = mock<EStim2bProtocol>();
        const mockTransport = mock<DeviceWritableTransport>();
        const initialStatus = createStatus({ currentMode: EStim2bMode.pulse });
        const responseStatus = createStatus({ currentMode: EStim2bMode.pulse, pulseFrequency: 75 });
        const encodedCommand = Buffer.from('C75');
        const responseBuffer = Buffer.from('response');

        mockProtocol.createSetPulseFrequencyCommand.mockReturnValue('C75');
        mockProtocol.encode.mockReturnValue(encodedCommand);
        mockTransport.sendAndAwaitReceive.mockResolvedValue(responseBuffer);
        mockProtocol.decode.mockReturnValue({ message: responseStatus });

        const device = createDevice(initialStatus, mockProtocol, mockTransport);

        // Act
        await device.setAttribute('pulseFrequency', Int.from(75));

        // Assert
        expect(mockProtocol.createSetPulseFrequencyCommand).toHaveBeenCalledWith(75);
        expect(mockTransport.sendAndAwaitReceive).toHaveBeenCalledWith(encodedCommand, 250);
        expect((await device.getAttribute('pulseFrequency'))?.value).toStrictEqual(Int.from(75));
    });

    it('it sets pulse PWM and updates attributes', async () => {

        // Arrange
        const mockProtocol = mock<EStim2bProtocol>();
        const mockTransport = mock<DeviceWritableTransport>();
        const initialStatus = createStatus({ currentMode: EStim2bMode.pulse });
        const responseStatus = createStatus({ currentMode: EStim2bMode.pulse, pulsePwm: 25 });
        const encodedCommand = Buffer.from('D25');
        const responseBuffer = Buffer.from('response');

        mockProtocol.createSetPulsePwmCommand.mockReturnValue('D25');
        mockProtocol.encode.mockReturnValue(encodedCommand);
        mockTransport.sendAndAwaitReceive.mockResolvedValue(responseBuffer);
        mockProtocol.decode.mockReturnValue({ message: responseStatus });

        const device = createDevice(initialStatus, mockProtocol, mockTransport);

        // Act
        await device.setAttribute('pulsePwm', Int.from(25));

        // Assert
        expect(mockProtocol.createSetPulsePwmCommand).toHaveBeenCalledWith(25);
        expect(mockTransport.sendAndAwaitReceive).toHaveBeenCalledWith(encodedCommand, 250);
        expect((await device.getAttribute('pulsePwm'))?.value).toStrictEqual(Int.from(25));
    });

    it('it sets high power mode to high', async () => {

        // Arrange
        const mockProtocol = mock<EStim2bProtocol>();
        const mockTransport = mock<DeviceWritableTransport>();
        const initialStatus = createStatus({ powerMode: 'L' });
        const responseStatus = createStatus({ powerMode: 'H' });
        const encodedCommand = Buffer.from('H');
        const responseBuffer = Buffer.from('response');

        mockProtocol.createSetPowerModeCommand.mockReturnValue('H');
        mockProtocol.encode.mockReturnValue(encodedCommand);
        mockTransport.sendAndAwaitReceive.mockResolvedValue(responseBuffer);
        mockProtocol.decode.mockReturnValue({ message: responseStatus });

        const device = createDevice(initialStatus, mockProtocol, mockTransport);

        // Act
        await device.setAttribute('highPowerMode', true);

        // Assert
        expect(mockProtocol.createSetPowerModeCommand).toHaveBeenCalledWith('H');
        expect(mockTransport.sendAndAwaitReceive).toHaveBeenCalledWith(encodedCommand, 250);
        expect((await device.getAttribute('highPowerMode'))?.value).toStrictEqual(true);
    });

    it('it sets high power mode to low', async () => {

        // Arrange
        const mockProtocol = mock<EStim2bProtocol>();
        const mockTransport = mock<DeviceWritableTransport>();
        const initialStatus = createStatus({ powerMode: 'H' });
        const responseStatus = createStatus({ powerMode: 'L' });
        const encodedCommand = Buffer.from('L');
        const responseBuffer = Buffer.from('response');

        mockProtocol.createSetPowerModeCommand.mockReturnValue('L');
        mockProtocol.encode.mockReturnValue(encodedCommand);
        mockTransport.sendAndAwaitReceive.mockResolvedValue(responseBuffer);
        mockProtocol.decode.mockReturnValue({ message: responseStatus });

        const device = createDevice(initialStatus, mockProtocol, mockTransport);

        // Act
        await device.setAttribute('highPowerMode', false);

        // Assert
        expect(mockProtocol.createSetPowerModeCommand).toHaveBeenCalledWith('L');
        expect(mockTransport.sendAndAwaitReceive).toHaveBeenCalledWith(encodedCommand, 250);
        expect((await device.getAttribute('highPowerMode'))?.value).toStrictEqual(false);
    });

    it('it throws when trying to set channelsJoined', async () => {

        // Arrange
        const mockProtocol = mock<EStim2bProtocol>();
        const mockTransport = mock<DeviceWritableTransport>();
        const device = createDevice(createStatus(), mockProtocol, mockTransport);

        // Act
        const result = device.setAttribute('channelsJoined', false);

        // Assert
        await expect(result).rejects.toThrow(
            `Could not set value false (type: boolean) for attribute 'channelsJoined'`
        );
        expect(mockTransport.sendAndAwaitReceive).not.toHaveBeenCalled();
    });

    it('it throws when trying to set batteryStatus', async () => {

        // Arrange
        const mockProtocol = mock<EStim2bProtocol>();
        const mockTransport = mock<DeviceWritableTransport>();
        const device = createDevice(createStatus(), mockProtocol, mockTransport);

        // Act
        const result = device.setAttribute('batteryStatus', 'mains');

        // Assert
        await expect(result).rejects.toThrow(
            `Could not set value "mains" (type: string) for attribute 'batteryStatus'`
        );
        expect(mockTransport.sendAndAwaitReceive).not.toHaveBeenCalled();
    });

    it('it throws when attribute does not exist on the device', async () => {

        // Arrange
        const mockProtocol = mock<EStim2bProtocol>();
        const mockTransport = mock<DeviceWritableTransport>();
        // Continuous mode only adds pulseFrequency — pulsePwm is absent
        const device = createDevice(createStatus({ currentMode: EStim2bMode.continuous }), mockProtocol, mockTransport);

        // Act
        const result = device.setAttribute('pulsePwm', Int.from(50));

        // Assert
        await expect(result).rejects.toThrow(`Attribute 'pulsePwm' does not exist`);
        expect(mockTransport.sendAndAwaitReceive).not.toHaveBeenCalled();
    });

    it('it propagates transport errors', async () => {

        // Arrange
        const mockProtocol = mock<EStim2bProtocol>();
        const mockTransport = mock<DeviceWritableTransport>();
        const errorMessage = 'Connection lost';

        mockProtocol.createSetPowerCommand.mockReturnValue('A50');
        mockProtocol.encode.mockReturnValue(Buffer.from('A50'));
        mockTransport.sendAndAwaitReceive.mockRejectedValue(new Error(errorMessage));

        const device = createDevice(createStatus(), mockProtocol, mockTransport);

        // Act
        const result = device.setAttribute('channelALevel', Int.from(50));

        // Assert
        await expect(result).rejects.toThrow(errorMessage);
        expect(mockProtocol.decode).not.toHaveBeenCalled();
    });

    it('it throws when protocol decode returns an error', async () => {

        // Arrange
        const mockProtocol = mock<EStim2bProtocol>();
        const mockTransport = mock<DeviceWritableTransport>();
        const responseBuffer = Buffer.from('bad response');

        mockProtocol.createSetPowerCommand.mockReturnValue('A50');
        mockProtocol.encode.mockReturnValue(Buffer.from('A50'));
        mockTransport.sendAndAwaitReceive.mockResolvedValue(responseBuffer);
        mockProtocol.decode.mockReturnValue({ error: { type: 'invalid_frame', reason: 'unexpected byte' } });

        const device = createDevice(createStatus(), mockProtocol, mockTransport);

        // Act
        const result = device.setAttribute('channelALevel', Int.from(50));

        // Assert
        await expect(result).rejects.toThrow("Invalid frame for response 'bad response': unexpected byte");
    });

    it('it updates attribute values on refresh', async () => {

        // Arrange
        const mockProtocol = mock<EStim2bProtocol>();
        const mockTransport = mock<DeviceWritableTransport>();
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

        // Act
        await device.refresh();

        // Assert
        expect(mockProtocol.createGetStatusCommand).toHaveBeenCalled();
        expect(mockTransport.sendAndAwaitReceive).toHaveBeenCalledWith(encodedCommand, 250);
        expect((await device.getAttribute('channelALevel'))?.value).toStrictEqual(Int.from(75));
        expect((await device.getAttribute('channelBLevel'))?.value).toStrictEqual(Int.from(40));
        expect((await device.getAttribute('pulseFrequency'))?.value).toStrictEqual(Int.from(80));
        expect((await device.getAttribute('pulsePwm'))?.value).toStrictEqual(Int.from(30));
        expect((await device.getAttribute('highPowerMode'))?.value).toStrictEqual(true);
        expect((await device.getAttribute('channelsJoined'))?.value).toStrictEqual(true);
        expect((await device.getAttribute('batteryStatus'))?.value).toStrictEqual('low');
    });
});
