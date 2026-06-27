import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { ActuatorType, SensorType, RequestServerInfo, RequestDeviceList, StartScanning, StopAllDevices, StopDeviceCmd, SensorReadCmd, ScalarCmd, StopScanning, Ping, fromJSON } from 'buttplug';

/**
 * Defines a mock actuator on a simulated Buttplug device.
 */
export interface MockActuator {
    featureDescriptor: string;
    actuatorType: ActuatorType;
    stepCount: number;
}

/**
 * Defines a mock sensor on a simulated Buttplug device.
 * sensorRange is [min, max].
 */
export interface MockSensor {
    featureDescriptor: string;
    sensorType: SensorType;
    sensorRange: [number, number];
    /** Current reading to return for SensorReadCmd (defaults to 0). */
    reading?: number;
}

export interface MockButtplugDevice {
    name: string;
    displayName?: string;
    actuators?: MockActuator[];
    sensors?: MockSensor[];
}

type IncomingScalarSubcommand = { Index: number; Scalar: number; ActuatorType: ActuatorType };

type IncomingMessage =
    RequestServerInfo |
    RequestDeviceList |
    StartScanning |
    StopScanning |
    ScalarCmd |
    SensorReadCmd |
    StopDeviceCmd |
    StopAllDevices |
    Ping;

/**
 * Minimal WebSocket server that speaks the Buttplug JSON protocol v3.
 *
 * Usage:
 *   const sim = new ButtplugIoServerSimulator();
 *   const port = await sim.start();
 *   // address used in provider config: `localhost:${port}`
 *   sim.addDevice({ name: 'MockVibe', actuators: [...], sensors: [...] });
 *   ...
 *   await sim.stop();
 */
export class ButtplugIoServerSimulator {
    private server: ReturnType<typeof createServer> | null = null;
    private wss: WebSocketServer | null = null;
    private connectedClients: Set<WebSocket> = new Set();
    private clientConnectedResolvers: Array<() => void> = [];
    private clientReadyResolvers: Array<() => void> = [];

    private devices: Map<number, MockButtplugDevice> = new Map();
    private nextDeviceIndex = 0;

    /** Recorded scalar commands: { deviceIndex, index, actuatorType, scalar }[] */
    public receivedScalarCmds: Array<{
        deviceIndex: number;
        index: number;
        actuatorType: ActuatorType;
        scalar: number;
    }> = [];

    public async start(): Promise<number> {
        return new Promise((resolve, reject) => {
            this.server = createServer();
            this.wss = new WebSocketServer({ server: this.server, path: '/buttplug' });

            this.wss.on('connection', (ws: WebSocket) => {
                this.connectedClients.add(ws);
                ws.on('message', (data: Buffer) => this.handleMessage(ws, data.toString()));
                ws.on('close', () => this.connectedClients.delete(ws));
                ws.on('error', () => this.connectedClients.delete(ws));
                for (const resolve of this.clientConnectedResolvers) resolve();
                this.clientConnectedResolvers = [];
            });

            this.server.listen(0, '127.0.0.1', () => {
                const addr = this.server?.address();
                if (addr && typeof addr === 'object') {
                    resolve(addr.port);
                } else {
                    reject(new Error('Could not determine server port'));
                }
            });

            this.server.on('error', reject);
        });
    }

    public removeAllDevices(): void {
        for (const deviceIndex of [...this.devices.keys()]) {
            this.removeDevice(deviceIndex);
        }
    }

    /** Resolves once the buttplug client has completed its handshake (RequestDeviceList received). */
    public waitForClientReady(timeoutMs = 5000): Promise<void> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Timed out waiting for buttplug client to be ready (>${timeoutMs}ms)`)), timeoutMs);
            this.clientReadyResolvers.push(() => { clearTimeout(timer); resolve(); });
        });
    }

    public async stop(): Promise<void> {
        for (const ws of this.connectedClients) {
            ws.close();
        }
        this.connectedClients.clear();

        await new Promise<void>((resolve, reject) => {
            this.wss?.close(err => err ? reject(err) : resolve());
        });
        await new Promise<void>((resolve, reject) => {
            this.server?.close(err => err ? reject(err) : resolve());
        });
    }

    /**
     * Add a device and notify all connected clients with a DeviceAdded push.
     * Returns the assigned device index.
     */
    public addDevice(device: MockButtplugDevice): number {
        const index = this.nextDeviceIndex++;
        this.devices.set(index, device);

        const msg = this.buildDeviceAddedMessage(index, device);
        this.broadcast(msg);

        return index;
    }

    /**
     * Remove a device and notify all connected clients with a DeviceRemoved push.
     */
    public removeDevice(deviceIndex: number): void {
        this.devices.delete(deviceIndex);
        this.broadcast(`[{"DeviceRemoved":{"Id":0,"DeviceIndex":${deviceIndex}}}]`);
    }

    public setSensorReading(deviceIndex: number, sensorIndex: number, value: number): void {
        const device = this.devices.get(deviceIndex);
        const sensor = device?.sensors?.[sensorIndex];
        if (sensor) {
            sensor.reading = value;
        }
    }

    private handleMessage(ws: WebSocket, raw: string): void {
        for (const msg of fromJSON(raw)) {
            this.handleSingleMessage(ws, msg);
        }
    }

    private handleSingleMessage(ws: WebSocket, msg: IncomingMessage): void {
        if (msg instanceof RequestServerInfo) {
            ws.send(
                `[{"ServerInfo":{"Id":${msg.Id},"MessageVersion":3,"MaxPingTime":0,"ServerName":"MockButtplugServer"}}]`
            );
        } else if (msg instanceof RequestDeviceList) {
            const deviceList = [...this.devices.entries()].map(([idx, dev]) =>
                JSON.stringify(this.buildDeviceInfo(idx, dev))
            );
            ws.send(
                `[{"DeviceList":{"Id":${msg.Id},"Devices":[${deviceList.join(',')}]}}]`
            );
            for (const resolve of this.clientReadyResolvers) resolve();
            this.clientReadyResolvers = [];
        } else if (msg instanceof StartScanning) {
            ws.send(`[{"Ok":{"Id":${msg.Id}}}]`);
            ws.send(`[{"ScanningFinished":{"Id":0}}]`);
        } else if (msg instanceof StopScanning) {
            ws.send(`[{"Ok":{"Id":${msg.Id}}}]`);
        } else if (msg instanceof ScalarCmd) {
            for (const s of msg.Scalars) {
                this.receivedScalarCmds.push({
                    deviceIndex: msg.DeviceIndex,
                    index: s.Index,
                    actuatorType: s.ActuatorType,
                    scalar: s.Scalar,
                });
            }
            ws.send(`[{"Ok":{"Id":${msg.Id}}}]`);
        } else if (msg instanceof SensorReadCmd) {
            const device = this.devices.get(msg.DeviceIndex);
            const sensor = device?.sensors?.[msg.SensorIndex];
            const reading = sensor?.reading ?? 0;
            ws.send(
                `[{"SensorReading":{"Id":${msg.Id},"DeviceIndex":${msg.DeviceIndex},"SensorIndex":${msg.SensorIndex},"SensorType":"${msg.SensorType}","Data":[${reading},0]}}]`
            );
        } else if (msg instanceof StopDeviceCmd) {
            ws.send(`[{"Ok":{"Id":${msg.Id}}}]`);
        } else if (msg instanceof StopAllDevices) {
            ws.send(`[{"Ok":{"Id":${msg.Id}}}]`);
        } else if (msg instanceof Ping) {
            ws.send(`[{"Ok":{"Id":${msg.Id}}}]`);
        }
    }

    private broadcast(msg: string): void {
        for (const ws of this.connectedClients) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(msg);
            }
        }
    }

    private buildDeviceAddedMessage(index: number, device: MockButtplugDevice): string {
        return `[{"DeviceAdded":${JSON.stringify({
            Id: 0,
            ...this.buildDeviceInfo(index, device),
        })}}]`;
    }

    private buildDeviceInfo(index: number, device: MockButtplugDevice): object {
        const deviceMessages: Record<string, unknown> = {};

        if (device.actuators && device.actuators.length > 0) {
            deviceMessages['ScalarCmd'] = device.actuators.map((a, i) => ({
                FeatureDescriptor: a.featureDescriptor,
                ActuatorType: a.actuatorType,
                StepCount: a.stepCount,
                Index: i,
            }));
        }

        if (device.sensors && device.sensors.length > 0) {
            deviceMessages['SensorReadCmd'] = device.sensors.map((s, i) => ({
                FeatureDescriptor: s.featureDescriptor,
                SensorType: s.sensorType,
                SensorRange: s.sensorRange,
                Index: i,
            }));
        }

        return {
            DeviceIndex: index,
            DeviceName: device.name,
            DeviceDisplayName: device.displayName ?? device.name,
            DeviceMessageTimingGap: 0,
            DeviceMessages: deviceMessages,
        };
    }
}
