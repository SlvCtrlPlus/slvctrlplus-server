import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DeviceManagerEvent } from '../../src/device/deviceManager.js';
import { AnyDevice } from '../../src/device/device.js';
import { AttributeValue } from '../../src/device/attribute/deviceAttribute.js';
import Settings from '../../src/settings/settings.js';
import KnownDevice from '../../src/settings/knownDevice.js';
import DeviceSource from '../../src/settings/deviceSource.js';
import {
    TEST_DEVICE_ID,
    TEST_SOURCE_ID,
    NEW_DEVICE_ID,
    createTestApp,
    teardownTestApp,
    resetTestApp,
    connectDevices,
    TestApp,
} from './helpers/appHelper.js';

describe('Device events', () => {
    let app: TestApp;

    beforeAll(async () => {
        app = await createTestApp();
    });

    afterAll(async () => {
        await teardownTestApp(app);
    });

    beforeEach(async () => {
        await resetTestApp(app);
    });

    it('virtual device connected', async () => {
        await connectDevices(app.container, [{ id: TEST_DEVICE_ID, name: 'Test Random Generator' }]);

        const devices = app.container.get('device.manager').getConnectedDevices();

        expect(devices).toHaveLength(1);
        expect(devices[0].getDeviceId).toBe(TEST_DEVICE_ID);
    });

    it('virtual device gets refreshed', async () => {
        await connectDevices(app.container, [{ id: TEST_DEVICE_ID, name: 'Test Random Generator' }]);

        const deviceManager = app.container.get('device.manager');
        const device = deviceManager.getConnectedDevices()[0];

        let observedValue: AttributeValue;
        let changedValue: AttributeValue;

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                deviceManager.off(DeviceManagerEvent.deviceRefreshed, listener);
                reject(new Error('Timed out waiting for device value to change'));
            }, 1000);

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
        await connectDevices(app.container, [{ id: TEST_DEVICE_ID, name: 'Test Random Generator' }]);

        const deviceManager = app.container.get('device.manager');

        expect(deviceManager.getConnectedDevices()).toHaveLength(1);

        await connectDevices(app.container, [{ id: NEW_DEVICE_ID, name: 'Test Device 2', config: { min: 0, max: 50 } }]);

        const devices = deviceManager.getConnectedDevices();

        expect(devices).toHaveLength(2);
        const actualDeviceIds = new Set(devices.map(d => d.getDeviceId));
        expect(actualDeviceIds).toEqual(new Set([TEST_DEVICE_ID, NEW_DEVICE_ID]));
    }, 1000);

    it('dynamically removes a virtual device deleted from settings', async () => {
        await connectDevices(app.container, [
            { id: TEST_DEVICE_ID, name: 'Test Random Generator' },
            { id: NEW_DEVICE_ID, name: 'Test Device 2', config: { min: 0, max: 50 } },
        ]);

        const deviceManager = app.container.get('device.manager');
        const settingsManager = app.container.get('settings.manager');

        const deviceDisconnected = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timed out waiting for device to disconnect')), 1000);

            const listener = (device: AnyDevice) => {
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
        settingsWithOneDevice.addKnownDevice(new KnownDevice(TEST_DEVICE_ID, 'Test Random Generator', 'randomGenerator', 'virtual', { min: 0, max: 100 }));
        settingsManager.replace(settingsWithOneDevice);

        await deviceDisconnected;
    }, 1000);

    it('disabling a known device closes it and re-enabling it reconnects it', async () => {
        await connectDevices(app.container, [{ id: TEST_DEVICE_ID, name: 'Test Random Generator' }]);

        const deviceManager = app.container.get('device.manager');
        const settingsManager = app.container.get('settings.manager');

        expect(deviceManager.getConnectedDevices()).toHaveLength(1);

        const disabledSettings = new Settings();
        disabledSettings.addDeviceSource(new DeviceSource(TEST_SOURCE_ID, 'virtual', {}));
        disabledSettings.addKnownDevice(
            new KnownDevice(TEST_DEVICE_ID, 'Test Random Generator', 'randomGenerator', 'virtual', { min: 0, max: 100 }, false)
        );

        const deviceDisconnected = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timed out waiting for device to disconnect')), 1000);
            const listener = (device: AnyDevice) => {
                if (device.getDeviceId === TEST_DEVICE_ID) {
                    clearTimeout(timeout);
                    deviceManager.off(DeviceManagerEvent.deviceDisconnected, listener);
                    resolve();
                }
            };
            deviceManager.on(DeviceManagerEvent.deviceDisconnected, listener);
        });

        settingsManager.replace(disabledSettings);
        await deviceDisconnected;

        expect(deviceManager.getConnectedDevices()).toHaveLength(0);

        const enabledSettings = new Settings();
        enabledSettings.addDeviceSource(new DeviceSource(TEST_SOURCE_ID, 'virtual', {}));
        enabledSettings.addKnownDevice(
            new KnownDevice(TEST_DEVICE_ID, 'Test Random Generator', 'randomGenerator', 'virtual', { min: 0, max: 100 }, true)
        );

        const deviceReconnected = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timed out waiting for device to reconnect')), 1000);
            const listener = (device: AnyDevice) => {
                if (device.getDeviceId === TEST_DEVICE_ID) {
                    clearTimeout(timeout);
                    deviceManager.off(DeviceManagerEvent.deviceConnected, listener);
                    resolve();
                }
            };
            deviceManager.on(DeviceManagerEvent.deviceConnected, listener);
        });

        settingsManager.replace(enabledSettings);
        await deviceReconnected;

        expect(deviceManager.getConnectedDevices()).toHaveLength(1);
    });

    it('disabling a device source stops its provider and removes its devices', async () => {
        await connectDevices(app.container, [{ id: TEST_DEVICE_ID, name: 'Test Random Generator' }]);

        const deviceManager = app.container.get('device.manager');
        const settingsManager = app.container.get('settings.manager');

        expect(deviceManager.getConnectedDevices()).toHaveLength(1);

        const disabledSourceSettings = new Settings();
        disabledSourceSettings.addDeviceSource(new DeviceSource(TEST_SOURCE_ID, 'virtual', {}, false));
        disabledSourceSettings.addKnownDevice(
            new KnownDevice(TEST_DEVICE_ID, 'Test Random Generator', 'randomGenerator', 'virtual', { min: 0, max: 100 })
        );

        const deviceDisconnected = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timed out waiting for device to disconnect')), 1000);
            const listener = (device: AnyDevice) => {
                if (device.getDeviceId === TEST_DEVICE_ID) {
                    clearTimeout(timeout);
                    deviceManager.off(DeviceManagerEvent.deviceDisconnected, listener);
                    resolve();
                }
            };
            deviceManager.on(DeviceManagerEvent.deviceDisconnected, listener);
        });

        settingsManager.replace(disabledSourceSettings);
        await deviceDisconnected;

        expect(deviceManager.getConnectedDevices()).toHaveLength(0);

        const reenabledSourceSettings = new Settings();
        reenabledSourceSettings.addDeviceSource(new DeviceSource(TEST_SOURCE_ID, 'virtual', {}, true));
        reenabledSourceSettings.addKnownDevice(
            new KnownDevice(TEST_DEVICE_ID, 'Test Random Generator', 'randomGenerator', 'virtual', { min: 0, max: 100 })
        );

        const deviceReconnected = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timed out waiting for device to reconnect')), 1000);
            const listener = (device: AnyDevice) => {
                if (device.getDeviceId === TEST_DEVICE_ID) {
                    clearTimeout(timeout);
                    deviceManager.off(DeviceManagerEvent.deviceConnected, listener);
                    resolve();
                }
            };
            deviceManager.on(DeviceManagerEvent.deviceConnected, listener);
        });

        settingsManager.replace(reenabledSourceSettings);
        await deviceReconnected;

        expect(deviceManager.getConnectedDevices()).toHaveLength(1);
    });

    it('virtual device disconnected', async () => {
        await connectDevices(app.container, [{ id: TEST_DEVICE_ID, name: 'Test Random Generator' }]);

        const deviceManager = app.container.get('device.manager');
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
