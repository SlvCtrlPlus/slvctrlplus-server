import DeviceTransport from '../../transport/deviceTransport.js';

export type EStim2bStatus = {
    batteryLevel: number,
    channelALevel:  number,
    channelBLevel:  number,
    pulseFrequency:  number,
    pulsePwm:  number,
    currentMode:  number,
    powerMode: string,
    channelsJoined: boolean,
    firmwareVersion: string,
};

export type EStim2Channel = 'A' | 'B';
export type EStim2PowerMode = 'H' | 'L';

export enum EStim2bMode {
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

export default class EStim2bProtocol
{
    private readonly transport: DeviceTransport;

    // Commands 'J' (join channels) and 'U' (unlink channels) are documented across the internet,
    // but they don't really exist. The official Commander3 app also doesn't allow joining/unlinking the channels.
    private static readonly commandRequestStatus = '';
    private static readonly commandSetPulseFrequency = 'C';
    private static readonly commandSetPulsePwm = 'D';
    private static readonly commandSetMode = 'M';
    private static readonly commandSetPowerZero = 'K';
    private static readonly commandReset = 'E';

    public constructor(transport: DeviceTransport) {
        this.transport = transport;
    }

    /**
     * Returns the status the current status
     * @returns object
     */
    public async requestStatus(): Promise<EStim2bStatus> {
        return this.send(EStim2bProtocol.commandRequestStatus);
    }

    /**
     * Sets the mode (MODE_*)
     * @param mode
     */
    public async setMode(mode: number): Promise<EStim2bStatus> {
        if (mode < 0 || mode > 16) {
            throw new Error(`Mode is not valid, must be between 0 to 16 (but is ${mode})`);
        }

        return this.send(EStim2bProtocol.commandSetMode + mode);
    }

    /**
     * Sets the power mode and sets both channel to 0%
     * @param powerMode
     */
    public async setPowerMode(powerMode: EStim2PowerMode): Promise<EStim2bStatus> {
        return this.send(powerMode);
    }

    /**
     * Sets the power for a channel (CHANNEL_*) to the given percentage (0-99)
     * @param channel
     * @param percentage
     */
    public async setPower(channel: EStim2Channel, percentage: number): Promise<EStim2bStatus> {
        if (percentage < 0) {
            throw new Error('Percentage must be greater or equals 0');
        } else if (percentage > 99) {
            throw new Error('Percentage must be less or equals 99');
        }

        return this.send(channel + percentage);
    }

    public async setPulsePwm(pulsePwm: number): Promise<EStim2bStatus> {
        if (pulsePwm < 2) {
            throw new Error('Pulse PWM must be greater or equals 2');
        } else if (pulsePwm > 99) {
            throw new Error('Pulse PWM must be less or equals 99');
        }

        return this.send(EStim2bProtocol.commandSetPulsePwm + pulsePwm);
    }

    public setPulseFrequency(pulseFrequency: number): Promise<EStim2bStatus> {
        if (pulseFrequency < 2) {
            throw new Error('Pulse frequency must be greater or equals 2');
        } else if (pulseFrequency > 99) {
            throw new Error('Pulse frequency must be less or equals 99');
        }

        return this.send(EStim2bProtocol.commandSetPulseFrequency + pulseFrequency);
    }

    /**
     * Set channel A/B to 0%
     */
    public async setPowerZero(): Promise<EStim2bStatus> {
        return this.send(EStim2bProtocol.commandSetPowerZero);
    }

    /**
     * Set all channels to defaults (A/B: 0%, C/D: 50, Mode: Pulse)
     */
    public async reset(): Promise<EStim2bStatus> {
        return this.send(EStim2bProtocol.commandReset);
    }

    private async send(command: string): Promise<EStim2bStatus> {
        const result = await this.transport.sendAndAwaitReceive(`${command}\r`, 250);

        return EStim2bProtocol.parseResponse(result);
    }

    private static parseResponse(response: string): EStim2bStatus {
        const parts = response.split(':');

        if (9 !== parts.length) {
            throw new Error(
                `Could not parse status message of 2B device: expected 9 parts, got ${parts.length} (${response})`
            );
        }

        return {
            batteryLevel: parseInt(parts[0], 10),
            channelALevel: parseInt(parts[1], 10)/2,
            channelBLevel: parseInt(parts[2], 10)/2,
            pulseFrequency: parseInt(parts[3], 10)/2,
            pulsePwm: parseInt(parts[4], 10)/2,
            currentMode: parseInt(parts[5], 10),
            powerMode: parts[6],
            channelsJoined: parseInt(parts[7], 10) === 1,
            firmwareVersion: parts[8]
        };
    }
};
