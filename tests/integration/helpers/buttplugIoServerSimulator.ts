import { WebSocketServer, WebSocket } from 'ws';
import { createServer, IncomingMessage } from 'http';

/**
 * Defines a mock actuator on a simulated Buttplug device.
 */
export interface MockActuator {
    featureDescriptor: string;
    actuatorType: string;
    stepCount: number;
}

/**
 * Defines a mock sensor on a simulated Buttplug device.
 * sensorRange is [min, max].
 */
export interface MockSensor {
    featureDescriptor: string;
    sensorType: string;
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

interface ButtplugMessage {
    [type: string]: { Id: number; [key: string]: unknown };
}

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

    private devices: Map<number, MockButtplugDevice> = new Map();
    private nextDeviceIndex = 0;

    /** Recorded scalar commands: { deviceIndex, index, actuatorType, scalar }[] */
    public receivedScalarCmds: Array<{
        deviceIndex: number;
        index: number;
        actuatorType: string;
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

    public async stop(): Promise<void> {
        for (const ws of this.connectedClients) {
            ws.close();
        }
        this.connectedClients.clear();

        await new Promise<void>((resolve, reject) => {
            this.wss?.close(err => (err ? reject(err) : resolve()));
        });
        await new Promise<void>((resolve, reject) => {
            this.server?.close(err => (err ? reject(err) : resolve()));
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
        let messages: ButtplugMessage[];
        try {
            messages = JSON.parse(raw) as ButtplugMessage[];
        } catch {
            return;
        }

        for (const msg of messages) {
            const type = Object.keys(msg)[0];
            if (undefined === type) continue;
            const payload = msg[type];
            if (undefined === payload) continue;

            this.handleSingleMessage(ws, type, payload);
        }
    }

    private handleSingleMessage(
        ws: WebSocket,
        type: string,
        payload: { Id: number; [key: string]: unknown }
    ): void {
        const id = payload.Id;

        switch (type) {
            case 'RequestServerInfo':
                ws.send(
                    `[{"ServerInfo":{"Id":${id},"MessageVersion":3,"MaxPingTime":0,"ServerName":"MockButtplugServer"}}]`
                );
                break;

            case 'RequestDeviceList': {
                const deviceList = [...this.devices.entries()].map(([idx, dev]) =>
                    JSON.stringify(this.buildDeviceInfo(idx, dev))
                );
                ws.send(
                    `[{"DeviceList":{"Id":${id},"Devices":[${deviceList.join(',')}]}}]`
                );
                break;
            }

            case 'StartScanning':
                ws.send(`[{"Ok":{"Id":${id}}}]`);
                ws.send(`[{"ScanningFinished":{"Id":0}}]`);
                break;

            case 'StopScanning':
                ws.send(`[{"Ok":{"Id":${id}}}]`);
                break;

            case 'ScalarCmd': {
                const scalars = payload.Scalars as Array<{
                    Index: number;
                    Scalar: number;
                    ActuatorType: string;
                }>;
                const deviceIndex = payload.DeviceIndex as number;
                if (Array.isArray(scalars)) {
                    for (const s of scalars) {
                        this.receivedScalarCmds.push({
                            deviceIndex,
                            index: s.Index,
                            actuatorType: s.ActuatorType,
                            scalar: s.Scalar,
                        });
                    }
                }
                ws.send(`[{"Ok":{"Id":${id}}}]`);
                break;
            }

            case 'SensorReadCmd': {
                const deviceIndex = payload.DeviceIndex as number;
                const sensorIndex = payload.SensorIndex as number;
                const sensorType = payload.SensorType as string;
                const device = this.devices.get(deviceIndex);
                const sensor = device?.sensors?.[sensorIndex];
                const reading = sensor?.reading ?? 0;
                ws.send(
                    `[{"SensorReading":{"Id":${id},"DeviceIndex":${deviceIndex},"SensorIndex":${sensorIndex},"SensorType":"${sensorType}","Data":[${reading},0]}}]`
                );
                break;
            }

            case 'StopDeviceCmd':
            case 'StopAllDevices':
            case 'Ping':
                ws.send(`[{"Ok":{"Id":${id}}}]`);
                break;

            default:
                ws.send(
                    `[{"Error":{"Id":${id},"ErrorMessage":"Unknown message: ${type}","ErrorCode":0}}]`
                );
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
