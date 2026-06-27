import type { SerialPortMock } from 'serialport';

type MockPortBinding = NonNullable<InstanceType<typeof SerialPortMock>['port']>;

export interface SlvCtrlPlusDeviceSimulatorConfig {
    deviceType?: string;
    fwVersion?: number;
    protocolVersion?: number;
    protocol?: 'v1' | 'legacy';
}

/**
 * Simulates a SlvCtrl+ device backed by a MockPortBinding.
 *
 * Supports both the V1 protocol and the legacy (<V1) protocol, controlled via the
 * `protocol` config option. The protocol shapes:
 *   - the `introduce` response format (positional for legacy, key:value for V1)
 *   - the attribute definition syntax (e.g. `rw[0-100]` for legacy, `rw[int(0..100)]` for V1)
 *   - the `set` command format (`set-X value` for legacy, `set X value` for V1)
 *   - the result suffix (`;ok` for legacy, `;status:ok` for V1)
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
 *   intensity   rw[int(0..100)]  /  rw[0-100]  (legacy)
 *   preset      rw[str(low|medium|high)]  /  rw[low|medium|high]  (legacy)
 *   channel     rw[int(1|2|3)]  /  rw[1|2|3]  (legacy)
 */
export class SlvCtrlPlusDeviceSimulator {
    private readonly deviceType: string;
    private readonly fwVersion: number;
    private readonly protocolVersion: number;
    private readonly protocol: 'v1' | 'legacy';

    private readonly v1AttributeDefs: string[] = [
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

    private readonly legacyAttributeDefs: string[] = [
        'connected:ro[bool]',
        'enabled:rw[bool]',
        'counter:ro[int]',
        'level:rw[int]',
        'temperature:ro[float]',
        'gain:rw[float]',
        'label:ro[str]',
        'mode:rw[str]',
        'intensity:rw[0-100]',
        'preset:rw[low|medium|high]',
        'channel:rw[1|2|3]',
    ];

    private port: MockPortBinding | null = null;

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
        this.protocol = config.protocol ?? 'v1';
        // Legacy protocol version defaults to 0 to signal pre-V1; V1 defaults to 1
        this.protocolVersion = config.protocolVersion ?? (this.protocol === 'legacy' ? 0 : 1);
    }

    /** Wire the simulator to a MockPortBinding once the port is open. */
    public attachToPort(bindingPort: MockPortBinding): void {
        this.port = bindingPort;
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

    /** Simulate the hardware being unplugged by closing the port binding. */
    public disconnect(): Promise<void> {
        if (this.port === null) {
            return Promise.resolve();
        }
        return this.port.close();
    }

    public getValue(name: string): string | undefined {
        return this.values[name];
    }

    public setValue(name: string, value: string): void {
        this.values[name] = value;
    }

    private get attributeDefs(): string[] {
        return this.protocol === 'legacy' ? this.legacyAttributeDefs : this.v1AttributeDefs;
    }

    private respond(command: string): string | null {
        if (command === 'clear') {
            return this.protocol === 'legacy' ? 'clear;;ok' : 'clear;;status:ok';
        }

        if (command === 'introduce') {
            if (this.protocol === 'legacy') {
                // Legacy format: positional, no status suffix — detected by the device factory
                // via the regex /^introduce;([^,;]+),(\d+),(\d+)$/
                return `introduce;${this.deviceType},${this.fwVersion},${this.protocolVersion}`;
            }
            return `introduce;type:${this.deviceType},fw:${this.fwVersion},protocol:${this.protocolVersion};status:ok`;
        }

        if (command === 'attributes') {
            const attrStr = this.attributeDefs.join(',');
            return this.protocol === 'legacy'
                ? `attributes;${attrStr};ok`
                : `attributes;${attrStr};status:ok`;
        }

        if (command === 'status') {
            const statusStr = Object.entries(this.values)
                .map(([k, v]) => `${k}:${v}`)
                .join(',');
            return this.protocol === 'legacy'
                ? `status;${statusStr};ok`
                : `status;${statusStr};status:ok`;
        }

        // V1 set command: "set level 5"
        if (this.protocol === 'v1' && command.startsWith('set ')) {
            const parts = command.split(' ');
            const attrName = parts[1];
            const value = parts.slice(2).join(' ');
            if (undefined !== attrName) {
                this.values[attrName] = value;
            }
            return `${command};value:${value};status:ok`;
        }

        // Legacy set command: "set-level 5"
        if (this.protocol === 'legacy' && command.startsWith('set-')) {
            const withoutPrefix = command.slice(4); // strip "set-"
            const spaceIdx = withoutPrefix.indexOf(' ');
            const attrName = spaceIdx >= 0 ? withoutPrefix.slice(0, spaceIdx) : withoutPrefix;
            const value = spaceIdx >= 0 ? withoutPrefix.slice(spaceIdx + 1) : '';
            if (attrName) {
                this.values[attrName] = value;
            }
            // Legacy result suffix is plain "ok", not "status:ok"
            return `${command};${value};ok`;
        }

        return null;
    }
}
