import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppInstance } from '../../src/app.js';
import { DeviceManagerEvent } from '../../src/device/deviceManager.js';
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

describe('Device events', () => {
    let instance: AppInstance;
    let tmpDir: string;

    beforeAll(async () => {
        ({ instance, tmpDir } = await createTestApp());
    });

    afterAll(async () => {
        await teardownTestApp(instance, tmpDir);
    });

    beforeEach(async () => {
        await resetTestApp(instance);
    });

    it('virtual device connected', async () => {
        await connectDevices(instance, [{ id: TEST_DEVICE_ID, name: 'Test Random Generator' }]);

        const devices = instance.container.get('device.manager').getConnectedDevices();

        expect(devices).toHaveLength(1);
        expect(devices[0].getDeviceId).toBe(TEST_DEVICE_ID);
    });

    it('virtual device gets refreshed', async () => {
        await connectDevices(instance, [{ id: TEST_DEVICE_ID, name: 'Test Random Generator' }]);

        const deviceManager = instance.container.get('device.manager');
        const device = deviceManager.getConnectedDevices()[0] as VirtualDevice<RandomGeneratorVirtualDeviceLogic>;

        let observedValue: number | undefined;
        let changedValue: number | undefined;

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timed out waiting for device value to change')), 1000);

            deviceManager.on(DeviceManagerEvent.deviceRefreshed, async () => {
                const value = (await device.getAttribute('value'))?.value;

                if (undefined === observedValue) {
                    observedValue = value;
                    return;
                }

                if (value !== observedValue) {
                    changedValue = value;
                    clearTimeout(timeout);
                    resolve();
                }
            });
        });

        expect(observedValue).toBeDefined();
        expect(changedValue).toBeDefined();
    });

    it('dynamically detects a new virtual device added to settings', async () => {
        await connectDevices(instance, [{ id: TEST_DEVICE_ID, name: 'Test Random Generator' }]);

        const deviceManager = instance.container.get('device.manager');

        expect(deviceManager.getConnectedDevices()).toHaveLength(1);

        await connectDevices(instance, [{ id: NEW_DEVICE_ID, name: 'Test Device 2', config: { min: 0, max: 50 } }]);

        const devices = deviceManager.getConnectedDevices();

        expect(devices).toHaveLength(2);
        expect(devices[0].getDeviceId).toBe(TEST_DEVICE_ID);
        expect(devices[1].getDeviceId).toBe(NEW_DEVICE_ID);
    }, 1000);

    it('dynamically removes a virtual device deleted from settings', async () => {
        await connectDevices(instance, [
            { id: TEST_DEVICE_ID, name: 'Test Random Generator' },
            { id: NEW_DEVICE_ID, name: 'Test Device 2', config: { min: 0, max: 50 } },
        ]);

        const deviceManager = instance.container.get('device.manager');
        const settingsManager = instance.container.get('settings.manager');

        const deviceDisconnected = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timed out waiting for device to disconnect')), 1000);

            deviceManager.on(DeviceManagerEvent.deviceDisconnected, (device) => {
                if (device.getDeviceId === NEW_DEVICE_ID) {
                    clearTimeout(timeout);
                    resolve();
                }
            });
        });

        const settingsWithOneDevice = new Settings();
        settingsWithOneDevice.addDeviceSource(new DeviceSource(TEST_SOURCE_ID, 'virtual', {}));
        settingsWithOneDevice.addKnownDevice(new KnownDevice(TEST_DEVICE_ID, TEST_DEVICE_ID, 'Test Random Generator', 'randomGenerator', 'virtual', { min: 0, max: 100 }));
        settingsManager.replace(settingsWithOneDevice);

        await deviceDisconnected;
    }, 1000);

    it('virtual device disconnected', async () => {
        await connectDevices(instance, [{ id: TEST_DEVICE_ID, name: 'Test Random Generator' }]);

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
