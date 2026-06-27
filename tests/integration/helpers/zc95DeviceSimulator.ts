import type { SerialPortMock } from 'serialport';

type MockPortBinding = NonNullable<InstanceType<typeof SerialPortMock>['port']>;

const STX = 0x02;
const ETX = 0x03;
const EOT = 0x04;

interface Zc95SimulatorPattern {
    id: number;
    name: string;
    menuItems?: Array<{
        Id: number;
        Title: string;
        Group?: number;
        Type: 'MIN_MAX' | 'MULTI_CHOICE';
        Default: number;
        Min?: number;
        Max?: number;
        IncrementStep?: number;
        UoM?: string;
        Choices?: Array<{ Id: number; Name: string }>;
    }>;
}

export class Zc95DeviceSimulator {
    private port: MockPortBinding | null = null;

    private readonly fwVersion: string;
    private readonly patterns: Zc95SimulatorPattern[];

    public readonly receivedCommands: Array<{ type: string; msgId: number; data: Record<string, unknown> }> = [];

    public constructor(config?: { fwVersion?: string; patterns?: Zc95SimulatorPattern[] }) {
        this.fwVersion = config?.fwVersion ?? 'test-v1.0';
        this.patterns = config?.patterns ?? [{ id: 0, name: 'Test Pattern', menuItems: [] }];
    }

    public attachToPort(bindingPort: MockPortBinding): void {
        this.port = bindingPort;
        const originalWrite = bindingPort.write.bind(bindingPort);

        bindingPort.write = async (buffer: Buffer): Promise<void> => {
            await originalWrite(buffer);

            if (buffer.length === 1 && buffer[0] === EOT) {
                return;
            }

            const stxIdx = buffer.indexOf(STX);
            const etxIdx = buffer.lastIndexOf(ETX);

            if (stxIdx < 0 || etxIdx <= stxIdx) {
                return;
            }

            const jsonStr = buffer.toString('utf-8', stxIdx + 1, etxIdx);
            let msg: { Type: string; MsgId: number };
            try {
                msg = JSON.parse(jsonStr);
            } catch {
                return;
            }

            this.receivedCommands.push({ type: msg.Type, msgId: msg.MsgId, data: msg as unknown as Record<string, unknown> });

            const response = this.handleMessage(msg);
            if (null !== response) {
                const framed = Buffer.concat([
                    Buffer.from([STX]),
                    Buffer.from(JSON.stringify(response), 'utf-8'),
                    Buffer.from([ETX]),
                ]);
                setImmediate(() => {
                    bindingPort.emitData(framed);
                });
            }
        };
    }

    public disconnect(): Promise<void> {
        if (this.port === null) {
            return Promise.resolve();
        }
        return this.port.close();
    }

    /**
     * Emit an unsolicited PowerStatus message, mimicking the ZC95 firmware's behaviour of
     * periodically broadcasting channel power readings without a corresponding request.
     *
     * The device handles this in `processPowerStatusMessage` (MsgId === -1, Type === 'PowerStatus'),
     * updates the powerChannel attributes and calls `updateLastRefresh()`, which emits
     * `DeviceEvent.deviceRefreshed`.
     *
     * Power values are in raw units (0–1000); the device converts them to percentages via * 0.1.
     */
    public sendPowerStatus(channels: Array<{
        channel: number;
        outputPower: number;
        maxOutputPower: number;
        powerLimit: number;
    }>): void {
        if (this.port === null) {
            return;
        }

        const msg = {
            Type: 'PowerStatus',
            MsgId: -1,
            Result: 'OK',
            Channels: channels.map(c => ({
                Channel: c.channel,
                OutputPower: c.outputPower,
                MaxOutputPower: c.maxOutputPower,
                PowerLimit: c.powerLimit,
            })),
        };

        const framed = Buffer.concat([
            Buffer.from([STX]),
            Buffer.from(JSON.stringify(msg), 'utf-8'),
            Buffer.from([ETX]),
        ]);

        this.port.emitData(framed);
    }

    private handleMessage(msg: { Type: string; MsgId: number }): Record<string, unknown> | null {
        switch (msg.Type) {
            case 'GetVersion':
                return {
                    Type: 'VersionDetails',
                    MsgId: msg.MsgId,
                    Result: 'OK',
                    ZC95: this.fwVersion,
                    WsMajor: 1,
                    WsMinor: 0,
                };

            case 'GetPatterns':
                return {
                    Type: 'PatternList',
                    MsgId: msg.MsgId,
                    Result: 'OK',
                    Patterns: this.patterns.map(p => ({ Id: p.id, Name: p.name })),
                };

            case 'GetPatternDetail': {
                const id = String((msg as Record<string, unknown>).Id);
                const pattern = this.patterns.find(p => String(p.id) === id) ?? this.patterns[0];
                return {
                    Type: 'PatternDetail',
                    MsgId: msg.MsgId,
                    Result: 'OK',
                    Name: pattern.name,
                    Id: pattern.id,
                    ButtonA: '',
                    MenuItems: pattern.menuItems ?? [],
                };
            }

            case 'PatternStart':
            case 'PatternStop':
            case 'PatternMinMaxChange':
            case 'PatternMultiChoiceChange':
            case 'SetPower':
            case 'PatternSoftButton':
                return {
                    Type: 'Ack',
                    MsgId: msg.MsgId,
                    Result: 'OK',
                };

            default:
                return null;
        }
    }
}
