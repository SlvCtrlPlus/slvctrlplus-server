import { describe, expect, it } from 'vitest';
import EStim2bProtocol, { EStim2bMode, EStim2bStatus } from '../../../../../src/device/protocol/estim2b/estim2bProtocol.js';
import { expectToBeErrorDecodeResult, expectToBeSuccessfulDecodeResult } from '../../../helper/protocol.js';

describe('EStim2bProtocol', () => {
    const protocol = new EStim2bProtocol();

    function makeValidRawResponse(overrides: Partial<{
        batteryLevel: number;
        channelARaw: number;
        channelBRaw: number;
        pulseFrequencyRaw: number;
        pulsePwmRaw: number;
        currentMode: number;
        powerMode: string;
        channelsJoinedRaw: number;
        firmwareVersion: string;
    }> = {}): string {
        const v = {
            batteryLevel: 600,
            channelARaw: 20,
            channelBRaw: 10,
            pulseFrequencyRaw: 50,
            pulsePwmRaw: 50,
            currentMode: EStim2bMode.pulse,
            powerMode: 'L',
            channelsJoinedRaw: 0,
            firmwareVersion: '1.0.0',
            ...overrides,
        };
        return `${v.batteryLevel}:${v.channelARaw}:${v.channelBRaw}:${v.pulseFrequencyRaw}:${v.pulsePwmRaw}:${v.currentMode}:${v.powerMode}:${v.channelsJoinedRaw}:${v.firmwareVersion}`;
    }

    describe('encode', () => {
        it('encodes a command string to a UTF-8 buffer', () => {
            const result = protocol.encode('M5');

            expect(result).toBeInstanceOf(Buffer);
            expect(result.toString('utf-8')).toStrictEqual('M5');
        });

        it('encodes empty status request command', () => {
            const result = protocol.encode('');

            expect(result.toString('utf-8')).toStrictEqual('');
        });
    });

    describe('decode', () => {
        it('parses a valid 9-part response into the correct EStim2bStatus object', () => {
            const raw = makeValidRawResponse();

            const result = protocol.decode(Buffer.from(raw));

            expectToBeSuccessfulDecodeResult(result);
            const status: EStim2bStatus = result.message;
            expect(status.batteryLevel).toBe(600);
            expect(status.channelALevel).toBe(10);   // 20 / 2
            expect(status.channelBLevel).toBe(5);    // 10 / 2
            expect(status.pulseFrequency).toBe(25);  // 50 / 2
            expect(status.pulsePwm).toBe(25);        // 50 / 2
            expect(status.currentMode).toBe(EStim2bMode.pulse);
            expect(status.powerMode).toBe('L');
            expect(status.channelsJoined).toBe(false);
            expect(status.firmwareVersion).toBe('1.0.0');
        });

        it('channels joined is true when raw value is 1', () => {
            const raw = makeValidRawResponse({ channelsJoinedRaw: 1 });

            const result = protocol.decode(Buffer.from(raw));

            expectToBeSuccessfulDecodeResult(result);
            expect(result.message.channelsJoined).toBe(true);
        });

        it('returns error when response has fewer than 9 parts', () => {
            const result = protocol.decode(Buffer.from('600:20:10:50:50:0:L:0'));

            expectToBeErrorDecodeResult(result);
            expect(result.error.type).toStrictEqual('invalid_frame');
        });

        it('returns error when response has more than 9 parts', () => {
            const result = protocol.decode(Buffer.from('600:20:10:50:50:0:L:0:1.0.0:extra'));

            expectToBeErrorDecodeResult(result);
            expect(result.error.type).toStrictEqual('invalid_frame');
        });

        it('returns error when a numeric field is not a number', () => {
            const raw = makeValidRawResponse({ channelARaw: 'abc' as unknown as number });

            const result = protocol.decode(Buffer.from(raw));

            expectToBeErrorDecodeResult(result);
            expect(result.error.type).toStrictEqual('invalid_frame');
        });

        it('returns error when channelsJoined is not 0 or 1', () => {
            const raw = makeValidRawResponse({ channelsJoinedRaw: 2 });

            const result = protocol.decode(Buffer.from(raw));

            expectToBeErrorDecodeResult(result);
            expect(result.error.type).toStrictEqual('invalid_frame');
        });
    });

    describe('isResponseMatchingMessage', () => {
        it('always returns true regardless of response content', () => {
            expect(protocol.isResponseMatchingMessage()).toBe(true);
        });
    });

    describe('createGetStatusCommand', () => {
        it('returns an empty string', () => {
            expect(protocol.createGetStatusCommand()).toStrictEqual('');
        });
    });

    describe('createSetModeCommand', () => {
        it('returns M prefix followed by the mode number', () => {
            expect(protocol.createSetModeCommand(EStim2bMode.bounce)).toStrictEqual('M1');
        });

        it('throws when mode is out of range', () => {
            expect(() => protocol.createSetModeCommand(17)).toThrow('Mode must be an integer between 0 and 16');
        });

        it('throws when mode is negative', () => {
            expect(() => protocol.createSetModeCommand(-1)).toThrow('Mode must be an integer between 0 and 16');
        });

        it('throws for non-integer values', () => {
            expect(() => protocol.createSetModeCommand(1.5)).toThrow('Mode must be an integer between 0 and 16');
        });
    });

    describe('createSetPowerModeCommand', () => {
        it('returns H for high power mode', () => {
            expect(protocol.createSetPowerModeCommand('H')).toStrictEqual('H');
        });

        it('returns L for low power mode', () => {
            expect(protocol.createSetPowerModeCommand('L')).toStrictEqual('L');
        });
    });

    describe('createSetPowerCommand', () => {
        it('returns channel letter followed by percentage number', () => {
            expect(protocol.createSetPowerCommand('A', 50)).toStrictEqual('A50');
            expect(protocol.createSetPowerCommand('B', 0)).toStrictEqual('B0');
        });

        it('throws when percentage exceeds 99', () => {
            expect(() => protocol.createSetPowerCommand('A', 100)).toThrow('Percentage must be an integer between 0 and 99');
        });

        it('throws when percentage is negative', () => {
            expect(() => protocol.createSetPowerCommand('A', -1)).toThrow('Percentage must be an integer between 0 and 99');
        });
    });

    describe('createSetPulsePwmCommand', () => {
        it('returns D prefix followed by the pulsePwm value', () => {
            expect(protocol.createSetPulsePwmCommand(50)).toStrictEqual('D50');
        });

        it('throws when value is below the minimum of 2', () => {
            expect(() => protocol.createSetPulsePwmCommand(1)).toThrow('Pulse PWM must be an integer between 2 and 100');
        });

        it('throws when value exceeds 100', () => {
            expect(() => protocol.createSetPulsePwmCommand(101)).toThrow('Pulse PWM must be an integer between 2 and 100');
        });
    });

    describe('createSetPulseFrequencyCommand', () => {
        it('returns C prefix followed by the frequency value', () => {
            expect(protocol.createSetPulseFrequencyCommand(40)).toStrictEqual('C40');
        });

        it('throws when value is below the minimum of 2', () => {
            expect(() => protocol.createSetPulseFrequencyCommand(1)).toThrow('Pulse frequency must be an integer between 2 and 100');
        });

        it('throws when value exceeds 100', () => {
            expect(() => protocol.createSetPulseFrequencyCommand(101)).toThrow('Pulse frequency must be an integer between 2 and 100');
        });
    });

    describe('createPowerZeroCommand', () => {
        it('returns K', () => {
            expect(protocol.createPowerZeroCommand()).toStrictEqual('K');
        });
    });

    describe('createResetCommand', () => {
        it('returns E', () => {
            expect(protocol.createResetCommand()).toStrictEqual('E');
        });
    });
});
