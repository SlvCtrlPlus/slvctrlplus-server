import type { SerialPortMock } from 'serialport';

type MockPortBinding = NonNullable<InstanceType<typeof SerialPortMock>['port']>;

export class Estim2bDeviceSimulator {
    private port: MockPortBinding | null = null;

    private batteryLevel: number;
    private channelALevel: number;
    private channelBLevel: number;
    private pulseFrequency: number;
    private pulsePwm: number;
    private currentMode: number;
    private powerMode: 'H' | 'L';
    private channelsJoined: boolean;
    private readonly firmwareVersion: string;

    public readonly receivedCommands: string[] = [];

    public constructor(config?: { firmwareVersion?: string }) {
        this.batteryLevel = 800;
        this.channelALevel = 0;
        this.channelBLevel = 0;
        this.pulseFrequency = 50;
        this.pulsePwm = 50;
        this.currentMode = 0;
        this.powerMode = 'H';
        this.channelsJoined = false;
        this.firmwareVersion = config?.firmwareVersion ?? 'test-1.0';
    }

    public attachToPort(bindingPort: MockPortBinding): void {
        this.port = bindingPort;
        const originalWrite = bindingPort.write.bind(bindingPort);

        bindingPort.write = async (buffer: Buffer): Promise<void> => {
            await originalWrite(buffer);

            const raw = buffer.toString('utf-8');
            const command = raw.endsWith('\r') ? raw.slice(0, -1) : raw;

            this.receivedCommands.push(command);

            this.handleCommand(command);

            setImmediate(() => {
                bindingPort.emitData(Buffer.from(this.buildStatusResponse() + '\n', 'utf-8'));
            });
        };
    }

    public disconnect(): Promise<void> {
        if (this.port === null) {
            return Promise.resolve();
        }
        return this.port.close();
    }

    public setChannelALevel(value: number): void {
        this.channelALevel = value;
    }

    public setChannelBLevel(value: number): void {
        this.channelBLevel = value;
    }

    public setMode(mode: number): void {
        this.currentMode = mode;
    }

    public setPowerMode(mode: 'H' | 'L'): void {
        this.powerMode = mode;
    }

    public setPulseFrequency(value: number): void {
        this.pulseFrequency = value;
    }

    public setPulsePwm(value: number): void {
        this.pulsePwm = value;
    }

    public setBatteryLevel(adc: number): void {
        this.batteryLevel = adc;
    }

    private handleCommand(command: string): void {
        if (command === '') {
            return;
        }

        if (command === 'H') {
            this.powerMode = 'H';
            return;
        }

        if (command === 'L') {
            this.powerMode = 'L';
            return;
        }

        if (command === 'K') {
            this.channelALevel = 0;
            this.channelBLevel = 0;
            return;
        }

        if (command === 'E') {
            this.channelALevel = 0;
            this.channelBLevel = 0;
            this.currentMode = 0;
            this.pulseFrequency = 50;
            this.pulsePwm = 50;
            this.powerMode = 'L';
            return;
        }

        if (command.startsWith('A')) {
            const value = parseInt(command.substring(1), 10);
            if (!isNaN(value) && value >= 0 && value <= 99) {
                this.channelALevel = value;
            }
            return;
        }

        if (command.startsWith('B')) {
            const value = parseInt(command.substring(1), 10);
            if (!isNaN(value) && value >= 0 && value <= 99) {
                this.channelBLevel = value;
            }
            return;
        }

        if (command.startsWith('M')) {
            const value = parseInt(command.substring(1), 10);
            if (!isNaN(value) && value >= 0 && value <= 16) {
                this.currentMode = value;
            }
            return;
        }

        if (command.startsWith('C')) {
            const value = parseInt(command.substring(1), 10);
            if (!isNaN(value) && value >= 2 && value <= 100) {
                this.pulseFrequency = value;
            }
            return;
        }

        if (command.startsWith('D')) {
            const value = parseInt(command.substring(1), 10);
            if (!isNaN(value) && value >= 2 && value <= 100) {
                this.pulsePwm = value;
            }
            return;
        }
    }

    private buildStatusResponse(): string {
        const chARaw = Math.round(this.channelALevel * 2);
        const chBRaw = Math.round(this.channelBLevel * 2);
        const freqRaw = Math.round(this.pulseFrequency * 2);
        const pwmRaw = Math.round(this.pulsePwm * 2);
        return `${this.batteryLevel}:${chARaw}:${chBRaw}:${freqRaw}:${pwmRaw}:${this.currentMode}:${this.powerMode}:${this.channelsJoined ? 1 : 0}:${this.firmwareVersion}`;
    }
}
