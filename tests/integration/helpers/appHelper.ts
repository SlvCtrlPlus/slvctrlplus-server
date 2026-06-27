import fs from 'fs';
import os from 'os';
import path from 'path';
import { io as ioClient } from 'socket.io-client';
import { createApp, AppInstance, createContainer, AppOptions } from '../../../src/app.js';
import Device from '../../../src/device/device.js';
import { DeviceManagerEvent } from '../../../src/device/deviceManager.js';
import { ServerToClientEvents } from '../../../src/socket/types.js';
type WsEmitCall = { [E in keyof ServerToClientEvents]: [E, ...Parameters<ServerToClientEvents[E]>] }[keyof ServerToClientEvents];
import KnownDevice from '../../../src/settings/knownDevice.js';
import Settings from '../../../src/settings/settings.js';
import DeviceSource from '../../../src/settings/deviceSource.js';
import ServiceMap from '../../../src/serviceMap.js';
import { Container } from '@timesplinter/pimple';
import MockSerialPortFactory from './mockSerialPortFactory.js';
import http from 'http';
import { AddressInfo } from 'net';

process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';

export const TEST_DEVICE_ID = 'a1b2c3d4-1234-4321-abcd-ef1234567890';
export const TEST_SOURCE_ID = 'b2c3d4e5-2345-4321-abcd-ef1234567891';
export const NEW_DEVICE_ID  = 'c3d4e5f6-3456-4321-abcd-ef1234567892';

export type DeviceSpec = { id: string, name: string, config?: { min: number, max: number } };

function makeBaseSettings(): Settings {
    const settings = new Settings();
    settings.addDeviceSource(new DeviceSource(TEST_SOURCE_ID, 'virtual', { scanIntervalMs: 50 }));
    return settings;
}

const baseSettingsJson = {
    knownDevices: {},
    deviceSources: {
        [TEST_SOURCE_ID]: {
            id: TEST_SOURCE_ID,
            type: 'virtual',
            config: { scanIntervalMs: 50 },
        },
    },
};

export type TestApp = Omit<AppInstance, 'serve'> & { 
    container: Container<ServiceMap>, 
    tmpDir: string,
    mockSerialPortFactory: MockSerialPortFactory, 
    httpServer: http.Server 
};

export const createTestApp = async (
    settingsJson: object = baseSettingsJson
): Promise<TestApp> => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slvctrlplus-test-'));
    const dataPath = tmpDir + path.sep;
    fs.writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify(settingsJson));

    const options: AppOptions = { dataPath, allowedOrigins: ['*'] };
    const container = createContainer(dataPath);

    const mockSerialPortFactory = new MockSerialPortFactory();
    container.replace('factory.serialPort', () => mockSerialPortFactory);

    const { websocket, serve, shutdown } = createApp(container, options);
    const httpServer = serve(0).httpServer;

    return { container, tmpDir, mockSerialPortFactory, websocket, httpServer, shutdown };
};

export const createWsClient = async (httpServer: http.Server): Promise<ReturnType<typeof import('socket.io-client').io>> => {
    const wsClient = ioClient(`http://localhost:${getServerPort(httpServer)}`);

    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            wsClient.close();
            reject(new Error('Failed to connect WebSocket client'));
        }, 2000);

        wsClient.on('connect', () => { clearTimeout(timeout); resolve(); });
        wsClient.on('connect_error', (err) => {
            clearTimeout(timeout);
            wsClient.close();
            reject(err);
        });
    });

    return wsClient;
};

export const teardownTestApp = async (app: TestApp): Promise<void> => {
    if (app.httpServer !== undefined) {
        app.httpServer.closeAllConnections();
    }

    await app.shutdown();

    fs.rmSync(app.tmpDir, { recursive: true });
};

export const resetTestApp = async (app: TestApp): Promise<void> => {
    const deviceManager = app.container.get('device.manager');
    const scriptRuntime = app.container.get('automation.scriptRuntime');
    const settingsManager = app.container.get('settings.manager');

    if (scriptRuntime.isRunning()) {
        await scriptRuntime.stop();
    }

    const connectedIds = deviceManager.getConnectedDevices().map(d => d.getDeviceId);

    if (connectedIds.length > 0) {
        // Drive disconnection through settings so VirtualDeviceProvider clears its
        // own attemptedDevices/connectedDevices maps via its normal discovery loop.
        // Calling device.close() directly would leave those maps stale.
        const remaining = new Set(connectedIds);
        const allGone = new Promise<void>((resolve, reject) => {
            const cleanup = () => {
                deviceManager.off(DeviceManagerEvent.deviceDisconnected, listener);
                clearTimeout(timeout);
            };
            const timeout = setTimeout(
                () => {
                    cleanup();
                    reject(new Error(`resetTestApp: ${[...remaining].join(', ')} did not disconnect within 1s`));
                },
                1000,
            );
            const listener = (device: { getDeviceId: string }) => {
                remaining.delete(device.getDeviceId);
                if (remaining.size === 0) {
                    cleanup();
                    resolve();
                }
            };
            deviceManager.on(DeviceManagerEvent.deviceDisconnected, listener);
        });

        settingsManager.replace(makeBaseSettings());
        await allGone;
    } else {
        settingsManager.replace(makeBaseSettings());
    }
};

export function getConnectedDevice(
    container: Container<ServiceMap>,
    predicate: (device: Device) => boolean,
    description: string,
): Device {
    const device = container.get('device.manager').getConnectedDevices().find(predicate);
    if (undefined === device) {
        throw new Error(`No connected device found: ${description}`);
    }
    return device;
}

export function waitForNDevicesConnected(container: Container<ServiceMap>, deviceCount: number, timeoutMs = 5000): Promise<Device[]> {
    return new Promise((resolve, reject) => {
        const deviceManager = container.get('device.manager');
        const connected: Device[] = [];

        const timeout = setTimeout(() => {
            deviceManager.off(DeviceManagerEvent.deviceConnected, listener);
            reject(new Error(`Timed out waiting for ${deviceCount} device(s) to connect (>${timeoutMs}ms), got ${connected.length}`));
        }, timeoutMs);

        const listener = (device: Device): void => {
            connected.push(device);
            if (connected.length >= deviceCount) {
                clearTimeout(timeout);
                deviceManager.off(DeviceManagerEvent.deviceConnected, listener);
                resolve(connected);
            }
        };

        deviceManager.on(DeviceManagerEvent.deviceConnected, listener);
    });
}

export function waitForNextWsEvent<E extends keyof ServerToClientEvents>(
    wsEmitSpy: { mock: { calls: ReadonlyArray<WsEmitCall> } },
    event: E,
    timeoutMs = 5000,
    predicate?: (params: Parameters<ServerToClientEvents[E]>) => boolean,
): Promise<Parameters<ServerToClientEvents[E]>> {
    const matchingCalls = () => wsEmitSpy.mock.calls
        .filter((call): call is Extract<WsEmitCall, [E, ...Parameters<ServerToClientEvents[E]>]> => call[0] === event)
        .map(([, ...params]) => params as Parameters<ServerToClientEvents[E]>)
        .filter(params => predicate === undefined || predicate(params));
    const countBefore = matchingCalls().length;
    return new Promise((resolve, reject) => {
        const deadline = Date.now() + timeoutMs;
        const poll = () => {
            const calls = matchingCalls();
            if (calls.length > countBefore) {
                resolve(calls[calls.length - 1]);
            } else if (Date.now() >= deadline) {
                reject(new Error(`Timed out waiting for WS event '${event}' (>${timeoutMs}ms)`));
            } else {
                setTimeout(poll, 10);
            }
        };
        poll();
    });
}

export const getServerPort = (server: http.Server): number => {
    const address = server.address();
    if (address !== null && typeof address === 'object') {
        return address.port;
    }
    throw new Error('Server address is not an AddressInfo');
}

export const connectDevices = (container: Container<ServiceMap>, specs: DeviceSpec[]): Promise<void> => {
    const deviceManager = container.get('device.manager');
    const settingsManager = container.get('settings.manager');

    const pendingIds = new Set(specs.map(s => s.id));

    const allConnected = new Promise<void>((resolve, reject) => {
        const listener = (device: { getDeviceId: string }) => {
            pendingIds.delete(device.getDeviceId);
            if (pendingIds.size === 0) {
                deviceManager.off(DeviceManagerEvent.deviceConnected, listener);
                clearTimeout(timeout);
                resolve();
            }
        };

        const timeout = setTimeout(() => {
            deviceManager.off(DeviceManagerEvent.deviceConnected, listener);
            reject(new Error(`Timed out waiting for devices to connect: ${[...pendingIds].join(', ')}`));
        }, 1000);

        deviceManager.on(DeviceManagerEvent.deviceConnected, listener);
    });

    const settings = settingsManager.load();
    for (const spec of specs) {
        settings.addKnownDevice(new KnownDevice(spec.id, spec.id, spec.name, 'randomGenerator', 'virtual', spec.config ?? { min: 0, max: 100 }));
    }
    settingsManager.replace(settings);

    return allConnected;
};
