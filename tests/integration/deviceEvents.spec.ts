import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppInstance } from '../../src/app.js';
import { DeviceManagerEvent } from '../../src/device/deviceManager.js';
import Device from '../../src/device/device.js';
import Settings from '../../src/settings/settings.js';
import KnownDevice from '../../src/settings/knownDevice.js';
import DeviceSource from '../../src/settings/deviceSource.js';
import RandomGeneratorVirtualDeviceLogic from '../../src/device/protocol/virtual/randomGenerator/randomGeneratorVirtualDeviceLogic.js';
import VirtualDevice from '../../src/device/protocol/virtual/virtualDevice.js';
import {
    TEST_DEVICE_ID,
    TEST_SOURCE_ID,
    NEW_DEVICE_ID,
    createTestApp,
    teardownTestApp,
    resetTestApp,
    connectDevices,
} from './helpers/appHelper.js';
import ServiceMap from '../../src/serviceMap.js';
import { Container } from '@timesplinter/pimple';

describe('Device events', () => {
    let app: AppInstance;
    let tmpDir: string;
    let container: Container<ServiceMap>;

    beforeAll(async () => {
        ({ app, container, tmpDir } = await createTestApp());
    });

    afterAll(async () => {
        await teardownTestApp(app, container, tmpDir);
    });

    beforeEach(async () => {
        await resetTestApp(app, container);
    });

    it('virtual device connected', async () => {
        await connectDevices(container, [{ id: TEST_DEVICE_ID, name: 'Test Random Generator' }]);

        const devices = container.get('device.manager').getConnectedDevices();

        expect(devices).toHaveLength(1);
        expect(devices[0].getDeviceId).toBe(TEST_DEVICE_ID);
    });

    it('virtual device gets refreshed', async () => {
        await connectDevices(container, [{ id: TEST_DEVICE_ID, name: 'Test Random Generator' }]);

        const deviceManager = container.get('device.manager');
        const device = deviceManager.getConnectedDevices()[0] as VirtualDevice<RandomGeneratorVirtualDeviceLogic>;

        let observedValue: number | undefined;
        let changedValue: number | undefined;

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timed out waiting for device value to change')), 1000);

            const listener = async () => {
                const value = (await device.getAttribute('value'))?.value;

                if (undefined === observedValue) {
                    observedValue = value;
                    return;
                }

                if (value !== observedValue) {
                    changedValue = value;
                    clearTimeout(timeout);
                    deviceManager.off(DeviceManagerEvent.deviceRefreshed, listener);
                    resolve();
                }
            };
            deviceManager.on(DeviceManagerEvent.deviceRefreshed, listener);
        });

        expect(observedValue).toBeDefined();
        expect(changedValue).toBeDefined();
    });

    it('dynamically detects a new virtual device added to settings', async () => {
        await connectDevices(container, [{ id: TEST_DEVICE_ID, name: 'Test Random Generator' }]);

        const deviceManager = container.get('device.manager');

        expect(deviceManager.getConnectedDevices()).toHaveLength(1);

        await connectDevices(container, [{ id: NEW_DEVICE_ID, name: 'Test Device 2', config: { min: 0, max: 50 } }]);

        const devices = deviceManager.getConnectedDevices();

        expect(devices).toHaveLength(2);
        const actualDeviceIds = new Set(devices.map(d => d.getDeviceId));
        expect(actualDeviceIds).toEqual(new Set([TEST_DEVICE_ID, NEW_DEVICE_ID]));
    }, 1000);

    it('dynamically removes a virtual device deleted from settings', async () => {
        await connectDevices(container, [
            { id: TEST_DEVICE_ID, name: 'Test Random Generator' },
            { id: NEW_DEVICE_ID, name: 'Test Device 2', config: { min: 0, max: 50 } },
        ]);

        const deviceManager = container.get('device.manager');
        const settingsManager = container.get('settings.manager');

        const deviceDisconnected = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timed out waiting for device to disconnect')), 1000);

            const listener = (device: Device) => {
                if (device.getDeviceId === NEW_DEVICE_ID) {
                    clearTimeout(timeout);
                    deviceManager.off(DeviceManagerEvent.deviceDisconnected, listener);
                    resolve();
                }
            };
            deviceManager.on(DeviceManagerEvent.deviceDisconnected, listener);
        });

        const settingsWithOneDevice = new Settings();
        settingsWithOneDevice.addDeviceSource(new DeviceSource(TEST_SOURCE_ID, 'virtual', {}));
        settingsWithOneDevice.addKnownDevice(new KnownDevice(TEST_DEVICE_ID, TEST_DEVICE_ID, 'Test Random Generator', 'randomGenerator', 'virtual', { min: 0, max: 100 }));
        settingsManager.replace(settingsWithOneDevice);

        await deviceDisconnected;
    }, 1000);

    it('virtual device disconnected', async () => {
        await connectDevices(container, [{ id: TEST_DEVICE_ID, name: 'Test Random Generator' }]);

        const deviceManager = container.get('device.manager');
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
