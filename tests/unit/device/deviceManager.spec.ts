import {describe, it, expect, beforeEach} from "vitest";
import {mock,mockClear} from "vitest-mock-extended";
import DeviceManager, { DeviceManagerEvent, DeviceInfo } from "../../../src/device/deviceManager.js";
import {EventEmitter} from "events";
import Device from "../../../src/device/device.js";
import TestDevice from "./testDevice.js";
import Logger from "../../../src/logging/Logger.js";
import { DeviceId } from "../../../src/device/deviceId.js";
import SettingsManager from "../../../src/settings/settingsManager.js";
import Settings from "../../../src/settings/settings.js";
import KnownDevice from "../../../src/settings/knownDevice.js";

describe('deviceManager', () => {
    // Returns `undefined` settings by default, which makes `isDeviceEnabled()` treat every
    // device as enabled - the desired default for tests unrelated to the enable/disable feature.
    const mockedSettingsManager = mock<SettingsManager>();

    it('it adds device to managed devices and emits an event', async () => {

        const mockedDeviceManagerEventEmitter = mock<EventEmitter>();

        const mockedLogger = mock<Logger>();
        mockedLogger.child.mockReturnValue(mockedLogger);

        const deviceManager = new DeviceManager(mockedDeviceManagerEventEmitter, new Map<string, Device>(), mockedSettingsManager, mockedLogger);

        const deviceId = DeviceId.create('test-device-id');
        const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());

        // New device connected
        expect(deviceManager.getConnectedDevices().length).toBe(0);

        deviceManager.addDevice({ type: 'test', id: deviceId }, device);

        let actualDevices = deviceManager.getConnectedDevices();

        expect(actualDevices.length).toBe(1);
        expect(actualDevices[0]).toBe(device);

        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledTimes(1);
        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledWith(DeviceManagerEvent.deviceConnected, device);
        expect(mockedLogger.child).toBeCalledWith({ name: DeviceManager.name });
    });


    it('it removes device from managed devices and emits event on disconnect', async () => {

        const connectedDevices = new Map<string, Device>();
        const deviceId = DeviceId.create('test-device-id');
        const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());

        const mockedDeviceManagerEventEmitter = mock<EventEmitter>();

        const mockedLogger = mock<Logger>();
        mockedLogger.child.mockReturnValue(mockedLogger);

        const deviceManager = new DeviceManager(mockedDeviceManagerEventEmitter, connectedDevices, mockedSettingsManager, mockedLogger);

        deviceManager.addDevice({ type: 'test', id: deviceId }, device);

        // Connected device refreshed
        await device.refresh();

        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledTimes(2);
        expect(mockedDeviceManagerEventEmitter.emit).toHaveBeenNthCalledWith(1, DeviceManagerEvent.deviceConnected, device);
        expect(mockedDeviceManagerEventEmitter.emit).toHaveBeenNthCalledWith(2, DeviceManagerEvent.deviceRefreshed, device);
        expect(mockedLogger.child).toBeCalledWith({ name: DeviceManager.name });

        mockClear(mockedDeviceManagerEventEmitter);
    });

    it('it emits an event on device update', async () => {

        const connectedDevices = new Map<string, Device>();
        const deviceId = DeviceId.create('test-device-id');
        const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());

        const mockedDeviceManagerEventEmitter = mock<EventEmitter>();

        const mockedLogger = mock<Logger>();
        mockedLogger.child.mockReturnValue(mockedLogger);

        const deviceManager = new DeviceManager(mockedDeviceManagerEventEmitter, connectedDevices, mockedSettingsManager, mockedLogger);

        deviceManager.addDevice({ type: 'test', id: deviceId }, device);

        // Connected device closed
        await device.close();

        expect(deviceManager.getConnectedDevices().length).toBe(0);

        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledTimes(2);
        expect(mockedDeviceManagerEventEmitter.emit).toHaveBeenNthCalledWith(1, DeviceManagerEvent.deviceConnected, device);
        expect(mockedDeviceManagerEventEmitter.emit).toHaveBeenNthCalledWith(2, DeviceManagerEvent.deviceDisconnected, device);
        expect(mockedLogger.child).toBeCalledWith({ name: DeviceManager.name });
    });

    describe('getConnectedDevice', () => {
        let mockedLogger: ReturnType<typeof mock<Logger>>;

        beforeEach(() => {
            mockedLogger = mock<Logger>();
            mockedLogger.child.mockReturnValue(mockedLogger);
        });

        it('returns the device when found by uuid', () => {
            const uuid = 'known-device-uuid';
            const device = mock<Device>();
            const connectedDevices = new Map<string, Device>([[uuid, device]]);
            const manager = new DeviceManager(mock<EventEmitter>(), connectedDevices, mockedSettingsManager, mockedLogger);

            expect(manager.getConnectedDevice(uuid)).toBe(device);
        });

        it('returns null when device is not found', () => {
            const manager = new DeviceManager(mock<EventEmitter>(), new Map(), mockedSettingsManager, mockedLogger);

            expect(manager.getConnectedDevice('unknown-uuid')).toBeNull();
        });
    });

    describe('announceDetectedDevice', () => {
        let mockedLogger: ReturnType<typeof mock<Logger>>;
        let mockedEventEmitter: ReturnType<typeof mock<EventEmitter>>;
        const deviceId = DeviceId.create('device-1');
        const deviceInfo: DeviceInfo = { type: 'test', id: deviceId };

        beforeEach(() => {
            mockedLogger = mock<Logger>();
            mockedLogger.child.mockReturnValue(mockedLogger);
            mockedEventEmitter = mock<EventEmitter>();
        });

        it('emits deviceDetected event for a newly seen device', () => {
            mockedEventEmitter.emit.mockReturnValue(true);
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedSettingsManager, mockedLogger);

            manager.announceDetectedDevice(deviceInfo);

            expect(mockedEventEmitter.emit).toHaveBeenCalledWith(DeviceManagerEvent.deviceDetected, deviceInfo);
        });

        it('does not re-announce a device already in the acquire queue', () => {
            mockedEventEmitter.emit.mockReturnValue(true);
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedSettingsManager, mockedLogger);

            manager.announceDetectedDevice(deviceInfo);
            manager.announceDetectedDevice(deviceInfo);

            expect(mockedEventEmitter.emit).toHaveBeenCalledOnce();
            expect(mockedEventEmitter.emit).toHaveBeenCalledWith(DeviceManagerEvent.deviceDetected, deviceInfo);
        });

        it('does not emit event when device is already connected', () => {
            const connectedDevices = new Map<string, Device>([[deviceId, mock<Device>()]]);
            const manager = new DeviceManager(mockedEventEmitter, connectedDevices, mockedSettingsManager, mockedLogger);

            manager.announceDetectedDevice(deviceInfo);

            expect(mockedEventEmitter.emit).not.toHaveBeenCalled();
        });

        it('removes device from queue when no listeners respond to deviceDetected', async () => {
            mockedEventEmitter.emit.mockReturnValue(false);
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedSettingsManager, mockedLogger);

            manager.announceDetectedDevice(deviceInfo);

            const result = await manager.acquireDetectedDevice(deviceId);
            expect(result.successful).toBe(false);
        });

        it('does not emit deviceDetected for a device belonging to a disabled known device', () => {
            mockedEventEmitter.emit.mockReturnValue(true);

            const settings = new Settings();
            settings.addKnownDevice(new KnownDevice(deviceId, 'Foo', 'test', 'test', {}, false));
            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(settings);

            const manager = new DeviceManager(mockedEventEmitter, new Map(), settingsManager, mockedLogger);

            manager.announceDetectedDevice(deviceInfo);

            expect(mockedEventEmitter.emit).not.toHaveBeenCalled();
        });
    });

    describe('acquireDetectedDevice', () => {
        let mockedLogger: ReturnType<typeof mock<Logger>>;
        let mockedEventEmitter: ReturnType<typeof mock<EventEmitter>>;
        const deviceId = DeviceId.create('device-2');
        const deviceInfo: DeviceInfo = { type: 'test', id: deviceId };

        beforeEach(() => {
            mockedLogger = mock<Logger>();
            mockedLogger.child.mockReturnValue(mockedLogger);
            mockedEventEmitter = mock<EventEmitter>();
            mockedEventEmitter.emit.mockReturnValue(true);
        });

        it('returns failure when device is not in the detect queue', async () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedSettingsManager, mockedLogger);

            const result = await manager.acquireDetectedDevice(deviceId);

            expect(result.successful).toBe(false);
        });

        it('resolves immediately with success for the first caller', async () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedSettingsManager, mockedLogger);
            manager.announceDetectedDevice(deviceInfo);

            const result = await manager.acquireDetectedDevice(deviceId);

            expect(result).toStrictEqual({ successful: true });
        });

        it('queues the second caller until the first releases', async () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedSettingsManager, mockedLogger);
            manager.announceDetectedDevice(deviceInfo);

            await manager.acquireDetectedDevice(deviceId);
            const secondCallerPromise = manager.acquireDetectedDevice(deviceId);
            manager.releaseDetectedDevice(deviceId);

            const result = await secondCallerPromise;
            expect(result).toStrictEqual({ successful: true });
        });
    });

    describe('releaseDetectedDevice', () => {
        let mockedLogger: ReturnType<typeof mock<Logger>>;
        let mockedEventEmitter: ReturnType<typeof mock<EventEmitter>>;
        const deviceId = DeviceId.create('device-3');
        const deviceInfo: DeviceInfo = { type: 'test', id: deviceId };

        beforeEach(() => {
            mockedLogger = mock<Logger>();
            mockedLogger.child.mockReturnValue(mockedLogger);
            mockedEventEmitter = mock<EventEmitter>();
            mockedEventEmitter.emit.mockReturnValue(true);
        });

        it('is a no-op when device is not in the acquire queue', () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedSettingsManager, mockedLogger);

            expect(() => manager.releaseDetectedDevice(DeviceId.create('unknown'))).not.toThrow();
        });

        it('removes device from queue after the only waiter releases', async () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedSettingsManager, mockedLogger);
            manager.announceDetectedDevice(deviceInfo);
            await manager.acquireDetectedDevice(deviceId);

            manager.releaseDetectedDevice(deviceId);

            const result = await manager.acquireDetectedDevice(deviceId);
            expect(result.successful).toBe(false);
        });
    });

    describe('revokeDetectedDevice', () => {
        let mockedLogger: ReturnType<typeof mock<Logger>>;
        let mockedEventEmitter: ReturnType<typeof mock<EventEmitter>>;
        const deviceId = DeviceId.create('device-4');
        const deviceInfo: DeviceInfo = { type: 'test', id: deviceId };

        beforeEach(() => {
            mockedLogger = mock<Logger>();
            mockedLogger.child.mockReturnValue(mockedLogger);
            mockedEventEmitter = mock<EventEmitter>();
            mockedEventEmitter.emit.mockReturnValue(true);
        });

        it('resolves a pending second caller with failure', async () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedSettingsManager, mockedLogger);
            manager.announceDetectedDevice(deviceInfo);
            await manager.acquireDetectedDevice(deviceId); // first caller holds
            const pendingPromise = manager.acquireDetectedDevice(deviceId); // second waits

            manager.revokeDetectedDevice(deviceInfo);

            const result = await pendingPromise;
            expect(result.successful).toBe(false);
        });

        it('drops a disabled device from pending retry so it is not re-announced after re-enabling', async () => {
            const settings = new Settings();
            settings.addKnownDevice(new KnownDevice(deviceId, 'Foo', 'test', 'test', {}, false));

            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(settings);

            const manager = new DeviceManager(mockedEventEmitter, new Map(), settingsManager, mockedLogger);

            // Announced while disabled -> parked in pending retry, no deviceDetected emitted.
            manager.announceDetectedDevice(deviceInfo);
            expect(mockedEventEmitter.emit).not.toHaveBeenCalled();

            // Device physically disappears while still disabled.
            manager.revokeDetectedDevice(deviceInfo);

            // Re-enabling it must NOT resurrect the gone device.
            settings.addKnownDevice(new KnownDevice(deviceId, 'Foo', 'test', 'test', {}, true));
            await manager.onSettingsChanged();

            expect(mockedEventEmitter.emit).not.toHaveBeenCalled();
        });
    });

    describe('claimDetectedDevice', () => {
        let mockedLogger: ReturnType<typeof mock<Logger>>;
        let mockedEventEmitter: ReturnType<typeof mock<EventEmitter>>;
        const deviceId = DeviceId.create('device-5');
        const deviceInfo: DeviceInfo = { type: 'test', id: deviceId };

        beforeEach(() => {
            mockedLogger = mock<Logger>();
            mockedLogger.child.mockReturnValue(mockedLogger);
            mockedEventEmitter = mock<EventEmitter>();
            mockedEventEmitter.emit.mockReturnValue(true);
        });

        it('resolves a pending caller with failure', async () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedSettingsManager, mockedLogger);
            manager.announceDetectedDevice(deviceInfo);
            await manager.acquireDetectedDevice(deviceId); // first caller holds
            const pendingPromise = manager.acquireDetectedDevice(deviceId); // second waits

            manager.claimDetectedDevice(deviceId);

            const result = await pendingPromise;
            expect(result.successful).toBe(false);
        });
    });

    describe('isDeviceEnabled', () => {
        let mockedLogger: ReturnType<typeof mock<Logger>>;

        beforeEach(() => {
            mockedLogger = mock<Logger>();
            mockedLogger.child.mockReturnValue(mockedLogger);
        });

        it('treats an unknown device as enabled', () => {
            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(new Settings());

            const manager = new DeviceManager(mock<EventEmitter>(), new Map(), settingsManager, mockedLogger);

            expect(manager.isDeviceEnabled(DeviceId.create('unknown'))).toBe(true);
        });

        it('treats a device as enabled when settings have not been loaded yet', () => {
            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(undefined);

            const manager = new DeviceManager(mock<EventEmitter>(), new Map(), settingsManager, mockedLogger);

            expect(manager.isDeviceEnabled(DeviceId.create('unknown'))).toBe(true);
        });

        it('reflects a known device\'s enabled state', () => {
            const deviceId = DeviceId.create('known-device');
            const settings = new Settings();
            settings.addKnownDevice(new KnownDevice(deviceId, 'Foo', 'test', 'test', {}, false));

            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(settings);

            const manager = new DeviceManager(mock<EventEmitter>(), new Map(), settingsManager, mockedLogger);

            expect(manager.isDeviceEnabled(deviceId)).toBe(false);
        });
    });

    describe('addDevice - disabled devices', () => {
        let mockedLogger: ReturnType<typeof mock<Logger>>;

        beforeEach(() => {
            mockedLogger = mock<Logger>();
            mockedLogger.child.mockReturnValue(mockedLogger);
        });

        it('does not register a device belonging to a disabled known device and closes it', () => {
            const deviceId = DeviceId.create('disabled-device');
            const settings = new Settings();
            settings.addKnownDevice(new KnownDevice(deviceId, 'Foo', 'test', 'test', {}, false));

            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(settings);

            const connectedDevices = new Map<string, Device>();
            const manager = new DeviceManager(mock<EventEmitter>(), connectedDevices, settingsManager, mockedLogger);

            const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());

            const added = manager.addDevice({ type: 'test', id: deviceId }, device);

            expect(added).toBe(false);
            expect(manager.getConnectedDevices()).toHaveLength(0);
        });

        it('registers a device belonging to an enabled known device', () => {
            const deviceId = DeviceId.create('enabled-device');
            const settings = new Settings();
            settings.addKnownDevice(new KnownDevice(deviceId, 'Foo', 'test', 'test', {}, true));

            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(settings);

            const manager = new DeviceManager(mock<EventEmitter>(), new Map(), settingsManager, mockedLogger);

            const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());

            const added = manager.addDevice({ type: 'test', id: deviceId }, device);

            expect(added).toBe(true);
            expect(manager.getConnectedDevices()).toHaveLength(1);
        });
    });

    describe('onSettingsChanged', () => {
        let mockedLogger: ReturnType<typeof mock<Logger>>;

        beforeEach(() => {
            mockedLogger = mock<Logger>();
            mockedLogger.child.mockReturnValue(mockedLogger);
        });

        it('closes connected devices whose known device has been disabled', async () => {
            const deviceId = DeviceId.create('device-to-disable');
            const enabledSettings = new Settings();
            enabledSettings.addKnownDevice(new KnownDevice(deviceId, 'Foo', 'test', 'test', {}, true));

            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(enabledSettings);

            const connectedDevices = new Map<string, Device>();
            const manager = new DeviceManager(mock<EventEmitter>(), connectedDevices, settingsManager, mockedLogger);

            const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());
            manager.addDevice({ type: 'test', id: deviceId }, device);
            expect(manager.getConnectedDevices()).toHaveLength(1);

            const disabledSettings = new Settings();
            disabledSettings.addKnownDevice(new KnownDevice(deviceId, 'Foo', 'test', 'test', {}, false));
            settingsManager.getSettings.mockReturnValue(disabledSettings);

            await manager.onSettingsChanged();

            expect(manager.getConnectedDevices()).toHaveLength(0);
        });

        it('leaves devices belonging to still-enabled known devices connected', async () => {
            const deviceId = DeviceId.create('device-still-enabled');
            const settings = new Settings();
            settings.addKnownDevice(new KnownDevice(deviceId, 'Foo', 'test', 'test', {}, true));

            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(settings);

            const connectedDevices = new Map<string, Device>();
            const manager = new DeviceManager(mock<EventEmitter>(), connectedDevices, settingsManager, mockedLogger);

            const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());
            manager.addDevice({ type: 'test', id: deviceId }, device);

            await manager.onSettingsChanged();

            expect(manager.getConnectedDevices()).toHaveLength(1);
        });

        it('re-announces a device rejected by announceDetectedDevice once its known device gets re-enabled', async () => {
            const deviceId = DeviceId.create('device-pending-1');
            const deviceInfo: DeviceInfo = { type: 'test', id: deviceId };

            const disabledSettings = new Settings();
            disabledSettings.addKnownDevice(new KnownDevice(deviceId, 'Foo', 'test', 'test', {}, false));

            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(disabledSettings);

            const mockedEventEmitter = mock<EventEmitter>();
            mockedEventEmitter.emit.mockReturnValue(true);

            const manager = new DeviceManager(mockedEventEmitter, new Map(), settingsManager, mockedLogger);

            manager.announceDetectedDevice(deviceInfo);
            expect(mockedEventEmitter.emit).not.toHaveBeenCalled();

            const enabledSettings = new Settings();
            enabledSettings.addKnownDevice(new KnownDevice(deviceId, 'Foo', 'test', 'test', {}, true));
            settingsManager.getSettings.mockReturnValue(enabledSettings);

            await manager.onSettingsChanged();

            expect(mockedEventEmitter.emit).toHaveBeenCalledWith(DeviceManagerEvent.deviceDetected, deviceInfo);
        });

        it('re-announces a device rejected by addDevice() only once its canonical known device gets re-enabled', async () => {
            // The device is detected under a preliminary id, but its final/canonical id (only
            // known after connecting, e.g. a serial number read during a handshake) is different.
            const detectionId = DeviceId.create('device-pending-2-detected');
            const canonicalId = DeviceId.create('device-pending-2-canonical');
            const deviceInfo: DeviceInfo = { type: 'test', id: detectionId };

            const settings = new Settings();
            // Only the canonical device is a known, disabled device.
            settings.addKnownDevice(new KnownDevice(canonicalId, 'Foo', 'test', 'test', {}, false));

            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(settings);

            const mockedEventEmitter = mock<EventEmitter>();
            mockedEventEmitter.emit.mockReturnValue(true);

            const manager = new DeviceManager(mockedEventEmitter, new Map(), settingsManager, mockedLogger);

            // Simulate a provider that connected a device via the detected-device pipeline whose
            // final id turns out to belong to a disabled device.
            const device = new TestDevice(canonicalId, 'Foo', new Date(), false, new EventEmitter());
            const added = manager.addDevice(deviceInfo, device);
            expect(added).toBe(false);

            // An unrelated settings change while the canonical device is still disabled must NOT
            // retry it (it would if the retry were gated by the still-unknown detection id).
            await manager.onSettingsChanged();
            expect(mockedEventEmitter.emit).not.toHaveBeenCalledWith(DeviceManagerEvent.deviceDetected, deviceInfo);

            // Enabling the canonical device does re-announce, under the original detection info.
            settings.addKnownDevice(new KnownDevice(canonicalId, 'Foo', 'test', 'test', {}, true));
            await manager.onSettingsChanged();

            expect(mockedEventEmitter.emit).toHaveBeenCalledWith(DeviceManagerEvent.deviceDetected, deviceInfo);
        });

        it('does not re-announce a still-disabled pending device', async () => {
            const deviceId = DeviceId.create('device-pending-3');
            const deviceInfo: DeviceInfo = { type: 'test', id: deviceId };

            const settings = new Settings();
            settings.addKnownDevice(new KnownDevice(deviceId, 'Foo', 'test', 'test', {}, false));

            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(settings);

            const mockedEventEmitter = mock<EventEmitter>();
            mockedEventEmitter.emit.mockReturnValue(true);

            const manager = new DeviceManager(mockedEventEmitter, new Map(), settingsManager, mockedLogger);

            const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());
            manager.addDevice(deviceInfo, device);

            mockClear(mockedEventEmitter);

            await manager.onSettingsChanged();

            expect(mockedEventEmitter.emit).not.toHaveBeenCalled();
        });
    });
});
