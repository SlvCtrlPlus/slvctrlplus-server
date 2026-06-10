import type { SerialPortMock } from 'serialport';

type MockPortBinding = NonNullable<InstanceType<typeof SerialPortMock>['port']>;

export interface SlvCtrlPlusDeviceSimulatorConfig {
    deviceType?: string;
    fwVersion?: number;
    protocolVersion?: number;
}

/**
 * Simulates a SlvCtrl+ V1 protocol device backed by a MockPortBinding.
 *
 * It intercepts writes from the application, parses the command, and emits
 * the appropriate protocol response via emitData(). The test device exposes
 * all supported attribute types so every parsing path can be exercised.
 *
 * Attribute map (name → definition):
 *   connected   ro[bool]
 *   enabled     rw[bool]
 *   counter     ro[int]
 *   level       rw[int]
 *   temperature ro[float]
 *   gain        rw[float]
 *   label       ro[str]
 *   mode        rw[str]
 *   intensity   rw[int(0..100)]
 *   preset      rw[str(low|medium|high)]
 *   channel     rw[int(1|2|3)]
 */
export class SlvCtrlPlusDeviceSimulator {
    private readonly deviceType: string;
    private readonly fwVersion: number;
    private readonly protocolVersion: number;

    private readonly attributeDefs: string[] = [
        'connected:ro[bool]',
        'enabled:rw[bool]',
        'counter:ro[int]',
        'level:rw[int]',
        'temperature:ro[float]',
        'gain:rw[float]',
        'label:ro[str]',
        'mode:rw[str]',
        'intensity:rw[int(0..100)]',
        'preset:rw[str(low|medium|high)]',
        'channel:rw[int(1|2|3)]',
    ];

    private values: Record<string, string> = {
        connected: '1',
        enabled: '0',
        counter: '42',
        level: '5',
        temperature: '36.6',
        gain: '0.5',
        label: 'TestDevice',
        mode: 'manual',
        intensity: '0',
        preset: 'low',
        channel: '1',
    };

    public constructor(config: SlvCtrlPlusDeviceSimulatorConfig = {}) {
        this.deviceType = config.deviceType ?? 'testDevice';
        this.fwVersion = config.fwVersion ?? 1;
        this.protocolVersion = config.protocolVersion ?? 1;
    }

    /** Wire the simulator to a MockPortBinding once the port is open. */
    public attachToPort(bindingPort: MockPortBinding): void {
        const originalWrite = bindingPort.write.bind(bindingPort);

        bindingPort.write = async (buffer: Buffer): Promise<void> => {
            await originalWrite(buffer);

            const command = buffer.toString('utf-8').trimEnd();
            const response = this.respond(command);

            if (null !== response) {
                // Use setImmediate so the response lands after writeAndExpect sets up its
                // data listener (the listener is registered before write() returns).
                setImmediate(() => {
                    bindingPort.emitData(Buffer.from(response + '\n', 'utf-8'));
                });
            }
        };
    }

    public getValue(name: string): string | undefined {
        return this.values[name];
    }

    public setValue(name: string, value: string): void {
        this.values[name] = value;
    }

    private respond(command: string): string | null {
        if (command === 'clear') {
            return 'clear;;status:ok';
        }

        if (command === 'introduce') {
            return `introduce;type:${this.deviceType},fw:${this.fwVersion},protocol:${this.protocolVersion};status:ok`;
        }

        if (command === 'attributes') {
            const attrStr = this.attributeDefs.join(',');
            return `attributes;${attrStr};status:ok`;
        }

        if (command === 'status') {
            const statusStr = Object.entries(this.values)
                .map(([k, v]) => `${k}:${v}`)
                .join(',');
            return `status;${statusStr};status:ok`;
        }

        if (command.startsWith('set ')) {
            const parts = command.split(' ');
            const attrName = parts[1];
            const value = parts.slice(2).join(' ');
            if (undefined !== attrName) {
                this.values[attrName] = value;
            }
            return `${command};value:${value};status:ok`;
        }

        return null;
    }
}
