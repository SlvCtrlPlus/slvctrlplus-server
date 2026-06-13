import fs from 'fs';
import os from 'os';
import path from 'path';
import { createApp, AppInstance, createContainer, AppOptions } from '../../../src/app.js';
import { DeviceManagerEvent } from '../../../src/device/deviceManager.js';
import KnownDevice from '../../../src/settings/knownDevice.js';
import Settings from '../../../src/settings/settings.js';
import DeviceSource from '../../../src/settings/deviceSource.js';
import ServiceMap from '../../../src/serviceMap.js';
import { Container, Pimple } from '@timesplinter/pimple';
import { SlvCtrlPlusDeviceSimulator } from './slvCtrlPlusDeviceSimulator.js';
import MockSerialPortFactory from './mockSerialPortFactory.js';

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

export const createTestApp = async (
    settingsJson: object = baseSettingsJson
): Promise<{ app: AppInstance, container: Container<ServiceMap>, tmpDir: string, serialPortSimulator: SlvCtrlPlusDeviceSimulator }> => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slvctrlplus-test-'));
    const dataPath = tmpDir + path.sep;
    fs.writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify(settingsJson));

    const options: AppOptions = { dataPath, allowedOrigins: ['*'] };
    const container = createContainer(dataPath);

    const serialPortSimulator = new SlvCtrlPlusDeviceSimulator();
    const mockPortFactory = new MockSerialPortFactory(serialPortSimulator);
    container.replace('factory.serialPort', () => mockPortFactory);

    const app = createApp(container, options);

    return { app, container, tmpDir, serialPortSimulator };
};

export const teardownTestApp = async (app: AppInstance, container: Container<ServiceMap>, tmpDir: string): Promise<void> => {
    const scriptRuntime = container.get('automation.scriptRuntime');
    if (scriptRuntime.isRunning()) {
        await scriptRuntime.stop();
    }

    container.get('device.provider.loader').stopProviders();

    await container.get('device.manager').reset();

    fs.rmSync(tmpDir, { recursive: true });
};

export const resetTestApp = async (app: AppInstance, container: Container<ServiceMap>): Promise<void> => {
    const deviceManager = container.get('device.manager');
    const scriptRuntime = container.get('automation.scriptRuntime');
    const settingsManager = container.get('settings.manager');

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
