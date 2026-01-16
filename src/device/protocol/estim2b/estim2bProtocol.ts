import { ReadlineParser, SerialPort } from 'serialport';
import EventEmitter from 'events';

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

export const enum EStim2bMode {
    pulse = 0,
    bounce = 1,
    continuous = 2,
    aSplit = 3,
    bSplit = 4,
    wave = 5,
    waterfall = 6,
    squeeze = 7,
    milk = 8,
    throb = 9,
    thrust = 10,
    random = 11,
    step = 12,
    training = 13,
    microphone = 14,
    stereo = 15,
    tickle = 16,
}

export interface EStim2bProtocolEvents {
    statusUpdated: [EStim2bStatus],
}

export default class EStim2bProtocol
{
    private port: SerialPort;

    private eventEmitter: EventEmitter<EStim2bProtocolEvents>;

    private status?: EStim2bStatus;

    private static commandRequestStatus = '';
    private static commandSetPulseFrequency = 'C';
    private static commandSetPulsePwm = 'D';
    private static commandSetMode = 'M';
    private static commandSetPowerZero = 'K';
    private static commandJoinChannels = 'J';
    private static commandUnjoinChannels = 'U';
    private static commandReset = 'E';

    public constructor(port: SerialPort, eventEmitter: EventEmitter<EStim2bProtocolEvents>) {
        this.port = port;
        this.eventEmitter = eventEmitter;

        const parser = new ReadlineParser();
        this.port.pipe(parser);

        parser.on('data', line => {
            this.status = EStim2bProtocol.parseResponse(line);
            this.eventEmitter.emit('statusUpdated', this.status);
        });
    }

    /**
     * Returns the status the current status
     * @returns object
     */
    public requestStatus(): void {
        this.send(EStim2bProtocol.commandRequestStatus);
    }

    /**
     * Sets the mode (MODE_*)
     * @param mode
     */
    public setMode(mode: number): void {
        if (mode < 0 || mode > 16) {
            throw new Error(`Mode is not valid, must be between 0 to 16 (but is ${mode})`);
        }

        this.send(EStim2bProtocol.commandSetMode + mode);
    }

    /**
     * Sets the power mode and sets both channel to 0%
     * @param powerMode
     */
    public setPowerMode(powerMode: EStim2PowerMode): void {
        this.send(powerMode);
    }

    /**
     * Sets the power for a channel (CHANNEL_*) to the given percentage (0-99)
     * @param channel
     * @param percentage
     */
    public setPower(channel: EStim2Channel, percentage: number): void {
        if (percentage < 0) {
            throw new Error('Percentage must be greater or equals 0');
        } else if (percentage > 99) {
            throw new Error('Percentage must be less or equals 99');
        }

        this.send(channel + percentage);
    }

    public setPulsePwm(pulsePwm: number): void {
        if (pulsePwm < 2) {
            throw new Error('Pulse PWM must be greater or equals 2');
        } else if (pulsePwm > 99) {
            throw new Error('Pulse PWM must be less or equals 99');
        }

        this.send(EStim2bProtocol.commandSetPulsePwm + pulsePwm);
    }

    public setPulseFrequency(pulseFrequency: number): void {
        if (pulseFrequency < 2) {
            throw new Error('Pulse frequency must be greater or equals 2');
        } else if (pulseFrequency > 99) {
            throw new Error('Pulse frequency must be less or equals 99');
        }

        this.send(EStim2bProtocol.commandSetPulseFrequency + pulseFrequency);
    }

    /**
     * Set channel A/B to 0%
     */
    public setPowerZero(): void {
        this.send(EStim2bProtocol.commandSetPowerZero);
    }

    public joinChannels(): void {
        this.send(EStim2bProtocol.commandJoinChannels);
    }

    public unlinkChannels(): void {
        this.send(EStim2bProtocol.commandUnjoinChannels);
    }

    /**
     * Set all channels to defaults (A/B: 0%, C/D: 50, Mode: Pulse)
     */
    public reset(): void {
        this.send(EStim2bProtocol.commandReset);
    }

    public on<K extends keyof EStim2bProtocolEvents>(
        eventName: K,
        handler: (...args: EStim2bProtocolEvents[K]) => void
    ): this {
        this.eventEmitter.on(eventName, handler);
        return this;
    }

    public off<K extends keyof EStim2bProtocolEvents>(
        eventName: K,
        handler: (...args: EStim2bProtocolEvents[K]) => void
    ): this {
        this.eventEmitter.off(eventName, handler);
        return this;
    }

    private send(command: string) {
        this.port.write(`${command}\r`);
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
