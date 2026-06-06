import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createApp, AppInstance } from '../../src/app.js';
import { DeviceManagerEvent } from '../../src/device/deviceManager.js';
import Settings from '../../src/settings/settings.js';
import KnownDevice from '../../src/settings/knownDevice.js';
import DeviceSource from '../../src/settings/deviceSource.js';
import RandomGeneratorVirtualDeviceLogic from '../../src/device/protocol/virtual/randomGenerator/randomGeneratorVirtualDeviceLogic.js';
import VirtualDevice from '../../src/device/protocol/virtual/virtualDevice.js';
import { Int } from '../../src/util/numbers.js';

process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';

const TEST_DEVICE_ID = 'a1b2c3d4-1234-4321-abcd-ef1234567890';
const TEST_SOURCE_ID = 'b2c3d4e5-2345-4321-abcd-ef1234567891';
const NEW_DEVICE_ID  = 'c3d4e5f6-3456-4321-abcd-ef1234567892';

const testSettings = {
    knownDevices: {
        [TEST_DEVICE_ID]: {
            id: TEST_DEVICE_ID,
            name: 'Test Random Generator',
            type: 'randomGenerator',
            source: 'virtual',
            config: { min: 0, max: 100 },
        },
    },
    deviceSources: {
        [TEST_SOURCE_ID]: {
            id: TEST_SOURCE_ID,
            type: 'virtual',
            config: { scanIntervalMs: 100 },
        },
    },
};

describe('App integration', () => {
    let instance: AppInstance;
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slvctrlplus-test-'));
        const settingsFilePath = path.join(tmpDir, 'settings.json');
        fs.writeFileSync(settingsFilePath, JSON.stringify(testSettings));

        instance = createApp({ settingsFilePath });

        const deviceManager = instance.container.get('device.manager');
        const deviceConnected = new Promise<void>(resolve => {
            deviceManager.on(DeviceManagerEvent.deviceConnected, () => resolve());
        });

        await instance.container.get('device.provider.loader').loadFromSettings();
        await deviceConnected;
    });

    afterEach(async () => {
        instance.container.get('device.provider.loader').stop();

        for (const device of instance.container.get('device.manager').getConnectedDevices()) {
            await device.close();
        }

        await new Promise<void>(resolve => instance.httpServer.close(() => resolve()));

        fs.rmSync(tmpDir, { recursive: true });
    });

    it('responds to devices endpoint', async () => {
        const res = await request(instance.expressApp).get('/devices');

        expect(res.status).toBe(200);
    });

    it('virtual device connected', () => {
        const devices = instance.container.get('device.manager').getConnectedDevices();

        expect(devices).toHaveLength(1);
        expect(devices[0].getDeviceId).toBe(TEST_DEVICE_ID);
    });

    it('virtual device gets refreshed', async () => {
        const deviceManager = instance.container.get('device.manager');
        const device = deviceManager.getConnectedDevices()[0] as VirtualDevice<RandomGeneratorVirtualDeviceLogic>;

        const firstValue = (await device.getAttribute('value'))?.value;

        const secondValue = await new Promise<Int | undefined>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timed out waiting for device refresh')), 2000);

            instance.container.get('device.manager').on(DeviceManagerEvent.deviceRefreshed, async () => {
                clearTimeout(timeout);
                resolve((await device.getAttribute('value'))?.value);
            });
        });

        expect(firstValue).toBeDefined();
        expect(secondValue).toBeDefined();
        expect(secondValue).not.toBe(firstValue);
    });

    it('dynamically detects a new virtual device added to settings', async () => {
        const deviceManager = instance.container.get('device.manager');
        const settingsManager = instance.container.get('settings.manager');

        expect(deviceManager.getConnectedDevices()).toHaveLength(1);


        const newSettings = new Settings();
        newSettings.addDeviceSource(new DeviceSource(TEST_SOURCE_ID, 'virtual', {}));
        newSettings.addKnownDevice(new KnownDevice(TEST_DEVICE_ID, TEST_DEVICE_ID, 'Test Random Generator', 'randomGenerator', 'virtual', { min: 0, max: 100 }));
        newSettings.addKnownDevice(new KnownDevice(NEW_DEVICE_ID, NEW_DEVICE_ID, 'Test Device 2', 'randomGenerator', 'virtual', { min: 0, max: 50 }));

        const newDeviceConnected = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timed out waiting for new device to connect')), 1000);

            deviceManager.on(DeviceManagerEvent.deviceConnected, (device) => {
                if (device.getDeviceId === NEW_DEVICE_ID) {
                    clearTimeout(timeout);
                    resolve();
                }
            });
        });

        settingsManager.replace(newSettings);

        await newDeviceConnected;

        const devices = deviceManager.getConnectedDevices();

        expect(devices).toHaveLength(2);
        expect(devices[0].getDeviceId).toBe(TEST_DEVICE_ID);
        expect(devices[1].getDeviceId).toBe(NEW_DEVICE_ID);
    }, 2000);

    it('dynamically removes a virtual device deleted from settings', async () => {
        const deviceManager = instance.container.get('device.manager');
        const settingsManager = instance.container.get('settings.manager');

        const settingsWithTwoDevices = new Settings();
        settingsWithTwoDevices.addDeviceSource(new DeviceSource(TEST_SOURCE_ID, 'virtual', {}));
        settingsWithTwoDevices.addKnownDevice(new KnownDevice(TEST_DEVICE_ID, TEST_DEVICE_ID, 'Test Random Generator', 'randomGenerator', 'virtual', { min: 0, max: 100 }));
        settingsWithTwoDevices.addKnownDevice(new KnownDevice(NEW_DEVICE_ID, NEW_DEVICE_ID, 'Test Device 2', 'randomGenerator', 'virtual', { min: 0, max: 50 }));

        const newDeviceConnected = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timed out waiting for new device to connect')), 1000);

            deviceManager.on(DeviceManagerEvent.deviceConnected, (device) => {
                if (device.getDeviceId === NEW_DEVICE_ID) {
                    clearTimeout(timeout);
                    resolve();
                }
            });
        });

        settingsManager.replace(settingsWithTwoDevices);

        await newDeviceConnected;

        const settingsWithOneDevice = new Settings();
        settingsWithOneDevice.addDeviceSource(new DeviceSource(TEST_SOURCE_ID, 'virtual', {}));
        settingsWithOneDevice.addKnownDevice(new KnownDevice(TEST_DEVICE_ID, TEST_DEVICE_ID, 'Test Random Generator', 'randomGenerator', 'virtual', { min: 0, max: 100 }));

        const newDeviceDisconnected = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timed out waiting for device to disconnect')), 1000);

            deviceManager.on(DeviceManagerEvent.deviceDisconnected, (device) => {
                if (device.getDeviceId === NEW_DEVICE_ID) {
                    clearTimeout(timeout);
                    resolve();
                }
            });
        });

        settingsManager.replace(settingsWithOneDevice);

        await newDeviceDisconnected;
    }, 4000);

    it('virtual device disconnected', async () => {
        const deviceManager = instance.container.get('device.manager');
        const device = deviceManager.getConnectedDevices()[0];

        const disconnected = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timed out waiting for device disconnection')), 2000);

            deviceManager.on(DeviceManagerEvent.deviceDisconnected, () => {
                clearTimeout(timeout);
                resolve();
            });
        });

        await device.close();
        await disconnected;
    });
});
