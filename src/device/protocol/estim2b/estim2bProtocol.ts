import DeviceProtocol, { DecodeResult, MessageResponse } from '../deviceProtocol.js';

export type EStim2bStatus = {
    batteryLevel: number,
    channelALevel: number,
    channelBLevel: number,
    pulseFrequency: number,
    pulsePwm: number,
    currentMode: number,
    powerMode: string,
    channelsJoined: boolean,
    firmwareVersion: string,
};

export type EStim2Channel = 'A' | 'B';
export type EStim2PowerMode = 'H' | 'L';

export enum EStim2bMode
{
    pulse = 0, // Pulse Rate, Pulse Feel
    bounce = 1, // Bounce Rate, Pulse Feel
    continuous = 2, // Pulse Feel
    aSplit = 3, // B Pulse Rate, Pulse Feel
    bSplit = 4, // A Pulse Rate, Pulse Feel
    wave = 5, // Flow, Granularity
    waterfall = 6, // Flow, Granularity
    squeeze = 7, // Pulse Speed, Feel
    milk = 8, // Pulse Speed, Feel
    throb = 9, // Range
    thrust = 10, // Range
    random = 11, // Range, Pulse Feel
    step = 12, // Step Size, Pulse Feel
    training = 13, // Jump Size, Pulse Feel
}

type Estim2bPowerModeCommand = EStim2PowerMode;
type Estim2bChannelCommand = `${EStim2Channel}${number}`;
type Estim2bModeCommand = `M${number}`;
type Estim2bSetPulseFrequencyCommand = `C${number}`;
type Estim2bSetPulsePwmCommand = `D${number}`;
type Estim2bPowerZeroCommand = 'K';
type Estim2bResetCommand = 'E';
type EStim2bGetStatusCommand = '';

export type Estim2bCommand =
    | Estim2bPowerModeCommand
    | Estim2bChannelCommand
    | Estim2bModeCommand
    | EStim2bGetStatusCommand
    | Estim2bSetPulseFrequencyCommand
    | Estim2bSetPulsePwmCommand
    | Estim2bPowerZeroCommand
    | Estim2bResetCommand
    ;

export default class EStim2bProtocol implements DeviceProtocol<MessageResponse<Estim2bCommand, EStim2bStatus>>
{
    public encode(command: Estim2bCommand): Buffer {
        return Buffer.from(`${command}`, 'utf-8');
    }

    public decode(data: Buffer): DecodeResult<EStim2bStatus> {
        return EStim2bProtocol.parseResponse(data.toString('utf-8'));
    }

    public isResponseMatchingMessage(): boolean {
        return true;
    }

    // Commands 'J' (join channels) and 'U' (unlink channels) are documented across the internet,
    // but they don't really exist. The official Commander3 app also doesn't allow joining/unlinking the channels.
    private static readonly commandRequestStatus = '';
    private static readonly commandSetPulseFrequency = 'C';
    private static readonly commandSetPulsePwm = 'D';
    private static readonly commandSetMode = 'M';
    private static readonly commandSetPowerZero = 'K';
    private static readonly commandReset = 'E';

    /**
     * Returns the status the current status
     * @returns object
     */
    public createGetStatusCommand(): EStim2bGetStatusCommand {
        return EStim2bProtocol.commandRequestStatus;
    }

    /**
     * Sets the mode (MODE_*)
     * @param mode
     */
    public createSetModeCommand(mode: number): Estim2bModeCommand {
        EStim2bProtocol.assertIntegerInRange('Mode', mode, 0, 16);

        return `${EStim2bProtocol.commandSetMode}${mode}`;
    }

    /**
     * Sets the power mode and sets both channel to 0%
     * @param powerMode
     */
    public createSetPowerModeCommand(powerMode: EStim2PowerMode): Estim2bPowerModeCommand {
        return powerMode;
    }

    /**
     * Sets the power for a channel (CHANNEL_*) to the given percentage (0-99)
     * @param channel
     * @param percentage
     */
    public createSetPowerCommand(channel: EStim2Channel, percentage: number): Estim2bChannelCommand {
        EStim2bProtocol.assertIntegerInRange('Percentage', percentage, 0, 99);

        return `${channel}${percentage}`;
    }

    public createSetPulsePwmCommand(pulsePwm: number): Estim2bSetPulsePwmCommand {
        EStim2bProtocol.assertIntegerInRange('Pulse PWM', pulsePwm, 2, 100);

        return `${EStim2bProtocol.commandSetPulsePwm}${pulsePwm}`;
    }

    public createSetPulseFrequencyCommand(pulseFrequency: number): Estim2bSetPulseFrequencyCommand {
        EStim2bProtocol.assertIntegerInRange('Pulse frequency', pulseFrequency, 2, 100);

        return `${EStim2bProtocol.commandSetPulseFrequency}${pulseFrequency}`;
    }

    /**
     * Set channel A/B to 0%
     */
    public createPowerZeroCommand(): Estim2bPowerZeroCommand {
        return EStim2bProtocol.commandSetPowerZero;
    }

    /**
     * Set all channels to defaults (A/B: 0%, C/D: 50, Mode: Pulse)
     */
    public createResetCommand(): Estim2bResetCommand {
        return EStim2bProtocol.commandReset;
    }

    private static assertIntegerInRange(label: string, value: number, min: number, max: number): void {
        if (!Number.isInteger(value) || value < min || value > max) {
            throw new Error(`${label} must be an integer between ${min} and ${max}, but is ${value}`);
        }
    }

    private static parseResponse(response: string): DecodeResult<EStim2bStatus> {
        const parts = response.split(':');

        if (9 !== parts.length) {
            return {
                error: {
                    type: 'invalid_frame',
                    reason: `Expected 9 parts, got ${parts.length} (${response})`
                }
            };
        }

        const batteryLevel = Number.parseInt(parts[0], 10);
        const channelARaw = Number.parseInt(parts[1], 10);
        const channelBRaw = Number.parseInt(parts[2], 10);
        const pulseFrequencyRaw = Number.parseInt(parts[3], 10);
        const pulsePwmRaw = Number.parseInt(parts[4], 10);
        const currentMode = Number.parseInt(parts[5], 10);
        const channelsJoinedRaw = Number.parseInt(parts[7], 10);

        if (
            Number.isNaN(batteryLevel) ||
            Number.isNaN(channelARaw) ||
            Number.isNaN(channelBRaw) ||
            Number.isNaN(pulseFrequencyRaw) ||
            Number.isNaN(pulsePwmRaw) ||
            Number.isNaN(currentMode) ||
            Number.isNaN(channelsJoinedRaw) ||
            ![0, 1].includes(channelsJoinedRaw)
        ) {
            return {
                error: {
                    type: 'invalid_frame',
                    reason: `Expected numeric fields in response (${response})`
                }
            };
        }

        return {
            message: {
                batteryLevel: batteryLevel,
                channelALevel: channelARaw / 2,
                channelBLevel: channelBRaw / 2,
                pulseFrequency: pulseFrequencyRaw / 2,
                pulsePwm: pulsePwmRaw / 2,
                currentMode: currentMode,
                powerMode: parts[6],
                channelsJoined: channelsJoinedRaw === 1,
                firmwareVersion: parts[8],
            }
        };
    }
};
