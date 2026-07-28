import {describe, it, expect, beforeEach, vi} from "vitest";
import {mock,mockClear} from "vitest-mock-extended";
import DeviceManager, { DeviceManagerEvent, DeviceDetectionInfo } from "../../../src/device/deviceManager.js";
import DeviceOfferRejectedError from "../../../src/device/deviceOfferRejectedError.js";
import {EventEmitter} from "events";
import Device, { AnyDevice } from "../../../src/device/device.js";
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

    // Announces the device and immediately offers it for connection - the only way to get a
    // device registered through the public API now that addDevice() is private.
    const connectDevice = async (manager: DeviceManager, deviceInfo: DeviceDetectionInfo, device: AnyDevice) => {
        manager.announceDetectedDevice(deviceInfo);
        return manager.offerDevice(deviceInfo, () => Promise.resolve(device));
    };

    it('it adds device to managed devices and emits an event', async () => {

        const mockedDeviceManagerEventEmitter = mock<EventEmitter>();
        mockedDeviceManagerEventEmitter.emit.mockReturnValue(true);

        const mockedLogger = mock<Logger>();
        mockedLogger.child.mockReturnValue(mockedLogger);

        const deviceManager = new DeviceManager(mockedDeviceManagerEventEmitter, new Map<string, Device>(), mockedSettingsManager, mockedLogger);

        const deviceId = DeviceId.create('test-device-id');
        const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());
        const deviceInfo: DeviceDetectionInfo = { type: 'test', detectionId: deviceId };

        // New device connected
        expect(deviceManager.getConnectedDevices().length).toBe(0);

        mockClear(mockedDeviceManagerEventEmitter); // drop the constructor-time noise, if any
        await connectDevice(deviceManager, deviceInfo, device);

        let actualDevices = deviceManager.getConnectedDevices();

        expect(actualDevices.length).toBe(1);
        expect(actualDevices[0]).toBe(device);

        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledWith(DeviceManagerEvent.deviceConnected, device);
        expect(mockedLogger.child).toBeCalledWith({ name: DeviceManager.name });
    });


    it('it removes device from managed devices and emits event on disconnect', async () => {

        const connectedDevices = new Map<string, Device>();
        const deviceId = DeviceId.create('test-device-id');
        const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());
        const deviceInfo: DeviceDetectionInfo = { type: 'test', detectionId: deviceId };

        const mockedDeviceManagerEventEmitter = mock<EventEmitter>();
        mockedDeviceManagerEventEmitter.emit.mockReturnValue(true);

        const mockedLogger = mock<Logger>();
        mockedLogger.child.mockReturnValue(mockedLogger);

        const deviceManager = new DeviceManager(mockedDeviceManagerEventEmitter, connectedDevices, mockedSettingsManager, mockedLogger);

        await connectDevice(deviceManager, deviceInfo, device);
        mockClear(mockedDeviceManagerEventEmitter);

        // Connected device refreshed
        await device.refresh();

        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledTimes(1);
        expect(mockedDeviceManagerEventEmitter.emit).toHaveBeenCalledWith(DeviceManagerEvent.deviceRefreshed, device);
        expect(mockedLogger.child).toBeCalledWith({ name: DeviceManager.name });
    });

    it('it emits an event on device update', async () => {

        const connectedDevices = new Map<string, Device>();
        const deviceId = DeviceId.create('test-device-id');
        const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());
        const deviceInfo: DeviceDetectionInfo = { type: 'test', detectionId: deviceId };

        const mockedDeviceManagerEventEmitter = mock<EventEmitter>();
        mockedDeviceManagerEventEmitter.emit.mockReturnValue(true);

        const mockedLogger = mock<Logger>();
        mockedLogger.child.mockReturnValue(mockedLogger);

        const deviceManager = new DeviceManager(mockedDeviceManagerEventEmitter, connectedDevices, mockedSettingsManager, mockedLogger);

        await connectDevice(deviceManager, deviceInfo, device);
        mockClear(mockedDeviceManagerEventEmitter);

        // Connected device closed
        await device.close();

        expect(deviceManager.getConnectedDevices().length).toBe(0);

        expect(mockedDeviceManagerEventEmitter.emit).toBeCalledTimes(1);
        expect(mockedDeviceManagerEventEmitter.emit).toHaveBeenCalledWith(DeviceManagerEvent.deviceDisconnected, device);
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
        const deviceInfo: DeviceDetectionInfo = { type: 'test', detectionId: deviceId };

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

            const result = await manager.offerDevice(deviceInfo, () => Promise.resolve(new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter())));
            expect(result.successful).toBe(false);
        });

        it('still emits deviceDetected even when the detection id matches a disabled known device', () => {
            // Detection id is preliminary/raw - e.g. for serial ports, multiple protocol
            // providers share the same detectionId but each computes its own distinct canonical
            // id via handshake. Gating here on detectionId's own enabled state would incorrectly
            // block every provider, including ones whose real canonical id isn't disabled at
            // all. The disabled check that actually matters happens per-canonical-id in
            // addDevice(), once a provider has connected and learned the final id.
            mockedEventEmitter.emit.mockReturnValue(true);

            const settings = new Settings();
            settings.addKnownDevice(new KnownDevice(deviceId, 'Foo', 'test', 'test', {}, false));
            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(settings);

            const manager = new DeviceManager(mockedEventEmitter, new Map(), settingsManager, mockedLogger);

            manager.announceDetectedDevice(deviceInfo);

            expect(mockedEventEmitter.emit).toHaveBeenCalledWith(DeviceManagerEvent.deviceDetected, deviceInfo);
        });
    });

    describe('offerDevice', () => {
        let mockedLogger: ReturnType<typeof mock<Logger>>;
        let mockedEventEmitter: ReturnType<typeof mock<EventEmitter>>;
        const deviceId = DeviceId.create('device-2');
        const deviceInfo: DeviceDetectionInfo = { type: 'test', detectionId: deviceId };

        beforeEach(() => {
            mockedLogger = mock<Logger>();
            mockedLogger.child.mockReturnValue(mockedLogger);
            mockedEventEmitter = mock<EventEmitter>();
            mockedEventEmitter.emit.mockReturnValue(true);
        });

        it('rejects with DeviceOfferRejectedError when device is not in the detect queue', async () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedSettingsManager, mockedLogger);

            const result = await manager.offerDevice(deviceInfo, () => Promise.resolve(new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter())));

            expect(result.successful).toBe(false);
            expect(!result.successful && result.reason).toBeInstanceOf(DeviceOfferRejectedError);
        });

        it('runs the first offer immediately and adds the device on success', async () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedSettingsManager, mockedLogger);
            manager.announceDetectedDevice(deviceInfo);

            const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());
            const result = await manager.offerDevice(deviceInfo, () => Promise.resolve(device));

            expect(result).toStrictEqual({ successful: true, device });
            expect(manager.getConnectedDevices()).toContain(device);
        });

        it('does not run a second offer while the first is still pending', async () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedSettingsManager, mockedLogger);
            manager.announceDetectedDevice(deviceInfo);

            let resolveFirstOffer!: (device: AnyDevice | undefined) => void;
            const firstOfferPromise = new Promise<AnyDevice | undefined>((resolve) => { resolveFirstOffer = resolve; });
            const secondOfferFn = vi.fn(() => Promise.resolve(new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter())));

            const firstResultPromise = manager.offerDevice(deviceInfo, () => firstOfferPromise);
            manager.offerDevice(deviceInfo, secondOfferFn);

            expect(secondOfferFn).not.toHaveBeenCalled();

            resolveFirstOffer(undefined);
            await firstResultPromise;
        });

        it('hands off to the next queued offer when the first one returns undefined', async () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedSettingsManager, mockedLogger);
            manager.announceDetectedDevice(deviceInfo);

            const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());

            const firstResultPromise = manager.offerDevice(deviceInfo, () => Promise.resolve(undefined));
            const secondResultPromise = manager.offerDevice(deviceInfo, () => Promise.resolve(device));

            const [firstResult, secondResult] = await Promise.all([firstResultPromise, secondResultPromise]);

            expect(firstResult.successful).toBe(false);
            expect(secondResult).toStrictEqual({ successful: true, device });
        });

        it('hands off to the next queued offer when the first one throws', async () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedSettingsManager, mockedLogger);
            manager.announceDetectedDevice(deviceInfo);

            const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());
            const offerError = new Error('connection failed');

            const firstResultPromise = manager.offerDevice(deviceInfo, () => Promise.reject(offerError));
            const secondResultPromise = manager.offerDevice(deviceInfo, () => Promise.resolve(device));

            const [firstResult, secondResult] = await Promise.all([firstResultPromise, secondResultPromise]);

            expect(firstResult).toStrictEqual({ successful: false, reason: offerError });
            expect(secondResult).toStrictEqual({ successful: true, device });
        });

        it('hands off to the next queued offer when the first device is disabled', async () => {
            // Detection id itself must stay enabled/unknown so announce() actually creates the
            // queue - only the canonical id of the first offered device (learned only once
            // connected, e.g. during a handshake) is disabled.
            const localDetectionId = DeviceId.create('device-2-detection');
            const localDeviceInfo: DeviceDetectionInfo = { type: 'test', detectionId: localDetectionId };
            const disabledCanonicalId = DeviceId.create('device-2-disabled-canonical');

            const settings = new Settings();
            settings.addKnownDevice(new KnownDevice(disabledCanonicalId, 'Foo', 'test', 'test', {}, false));
            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(settings);

            const manager = new DeviceManager(mockedEventEmitter, new Map(), settingsManager, mockedLogger);
            manager.announceDetectedDevice(localDeviceInfo);

            const disabledDevice = new TestDevice(disabledCanonicalId, 'Foo', new Date(), false, new EventEmitter());
            const enabledDevice = new TestDevice(DeviceId.create('device-2-enabled-canonical'), 'Foo', new Date(), false, new EventEmitter());

            const firstResultPromise = manager.offerDevice(localDeviceInfo, () => Promise.resolve(disabledDevice));
            const secondResultPromise = manager.offerDevice(localDeviceInfo, () => Promise.resolve(enabledDevice));

            const [firstResult, secondResult] = await Promise.all([firstResultPromise, secondResultPromise]);

            expect(firstResult.successful).toBe(false);
            expect(!firstResult.successful && firstResult.reason).toBeInstanceOf(DeviceOfferRejectedError);
            expect(secondResult).toStrictEqual({ successful: true, device: enabledDevice });
        });

        it('clears the queue and re-allows announcing after the only offer fails', async () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedSettingsManager, mockedLogger);
            manager.announceDetectedDevice(deviceInfo);

            await manager.offerDevice(deviceInfo, () => Promise.resolve(undefined));

            mockClear(mockedEventEmitter);
            mockedEventEmitter.emit.mockReturnValue(true);

            manager.announceDetectedDevice(deviceInfo);

            expect(mockedEventEmitter.emit).toHaveBeenCalledWith(DeviceManagerEvent.deviceDetected, deviceInfo);
        });

        it('rejects other queued offers with DeviceOfferRejectedError once a device is claimed', async () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedSettingsManager, mockedLogger);
            manager.announceDetectedDevice(deviceInfo);

            let resolveFirstOffer!: (device: AnyDevice | undefined) => void;
            const firstOfferPromise = new Promise<AnyDevice | undefined>((resolve) => { resolveFirstOffer = resolve; });
            const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());

            const firstResultPromise = manager.offerDevice(deviceInfo, () => firstOfferPromise);
            const secondResultPromise = manager.offerDevice(deviceInfo, () => Promise.reject(new Error('should never run')));

            resolveFirstOffer(device);

            const [firstResult, secondResult] = await Promise.all([firstResultPromise, secondResultPromise]);

            expect(firstResult).toStrictEqual({ successful: true, device });
            expect(secondResult.successful).toBe(false);
            expect(!secondResult.successful && secondResult.reason).toBeInstanceOf(DeviceOfferRejectedError);
        });
    });

    describe('revokeDetectedDevice', () => {
        let mockedLogger: ReturnType<typeof mock<Logger>>;
        let mockedEventEmitter: ReturnType<typeof mock<EventEmitter>>;
        const deviceId = DeviceId.create('device-4');
        const deviceInfo: DeviceDetectionInfo = { type: 'test', detectionId: deviceId };

        beforeEach(() => {
            mockedLogger = mock<Logger>();
            mockedLogger.child.mockReturnValue(mockedLogger);
            mockedEventEmitter = mock<EventEmitter>();
            mockedEventEmitter.emit.mockReturnValue(true);
        });

        it('resolves a pending offer with failure', async () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedSettingsManager, mockedLogger);
            manager.announceDetectedDevice(deviceInfo);

            // First offer never settles on its own, so it's still holding the queue when revoked
            const pendingPromise = manager.offerDevice(deviceInfo, () => new Promise<AnyDevice | undefined>(() => {}));

            manager.revokeDetectedDevice(deviceInfo);

            const result = await pendingPromise;
            expect(result.successful).toBe(false);
            expect(!result.successful && result.reason).toBeInstanceOf(DeviceOfferRejectedError);
        });

        it('drops a disabled device from pending retry so it is not re-announced after re-enabling', async () => {
            const settings = new Settings();
            settings.addKnownDevice(new KnownDevice(deviceId, 'Foo', 'test', 'test', {}, false));

            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(settings);

            const manager = new DeviceManager(mockedEventEmitter, new Map(), settingsManager, mockedLogger);

            // Announced (detection id happens to match the disabled known device) - the provider
            // still gets a chance to offer it, but addDevice() rejects it once connected since
            // it's disabled, parking it in pending retry.
            manager.announceDetectedDevice(deviceInfo);
            const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());
            const result = await manager.offerDevice(deviceInfo, () => Promise.resolve(device));
            expect(result.successful).toBe(false);

            mockClear(mockedEventEmitter);

            // Device physically disappears while still disabled.
            manager.revokeDetectedDevice(deviceInfo);

            // Re-enabling it must NOT resurrect the gone device.
            settings.addKnownDevice(new KnownDevice(deviceId, 'Foo', 'test', 'test', {}, true));
            await manager.onSettingsChanged();

            expect(mockedEventEmitter.emit).not.toHaveBeenCalled();
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

    describe('offerDevice - disabled devices', () => {
        let mockedLogger: ReturnType<typeof mock<Logger>>;
        let mockedEventEmitter: ReturnType<typeof mock<EventEmitter>>;

        beforeEach(() => {
            mockedLogger = mock<Logger>();
            mockedLogger.child.mockReturnValue(mockedLogger);
            mockedEventEmitter = mock<EventEmitter>();
            mockedEventEmitter.emit.mockReturnValue(true);
        });

        it('does not register a device whose canonical id belongs to a disabled known device, and closes it', async () => {
            // Detection id is unknown/enabled so announce() lets it through and the offer runs -
            // the device only turns out to be disabled once its canonical id is learned, e.g.
            // during a handshake. This is the only way to reach addDevice()'s own disabled-check
            // through the public API now that it's private.
            const detectionId = DeviceId.create('disabled-device-detection');
            const canonicalId = DeviceId.create('disabled-device-canonical');
            const deviceInfo: DeviceDetectionInfo = { type: 'test', detectionId };

            const settings = new Settings();
            settings.addKnownDevice(new KnownDevice(canonicalId, 'Foo', 'test', 'test', {}, false));

            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(settings);

            const connectedDevices = new Map<string, Device>();
            const manager = new DeviceManager(mockedEventEmitter, connectedDevices, settingsManager, mockedLogger);

            const device = new TestDevice(canonicalId, 'Foo', new Date(), false, new EventEmitter());

            const result = await connectDevice(manager, deviceInfo, device);

            expect(result.successful).toBe(false);
            expect(!result.successful && result.reason).toBeInstanceOf(DeviceOfferRejectedError);
            expect(manager.getConnectedDevices()).toHaveLength(0);
        });

        it('registers a device belonging to an enabled known device', async () => {
            const deviceId = DeviceId.create('enabled-device');
            const deviceInfo: DeviceDetectionInfo = { type: 'test', detectionId: deviceId };
            const settings = new Settings();
            settings.addKnownDevice(new KnownDevice(deviceId, 'Foo', 'test', 'test', {}, true));

            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(settings);

            const manager = new DeviceManager(mockedEventEmitter, new Map(), settingsManager, mockedLogger);

            const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());

            const result = await connectDevice(manager, deviceInfo, device);

            expect(result.successful).toBe(true);
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
            const deviceInfo: DeviceDetectionInfo = { type: 'test', detectionId: deviceId };
            const enabledSettings = new Settings();
            enabledSettings.addKnownDevice(new KnownDevice(deviceId, 'Foo', 'test', 'test', {}, true));

            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(enabledSettings);

            const connectedDevices = new Map<string, Device>();
            const mockedEventEmitter = mock<EventEmitter>();
            mockedEventEmitter.emit.mockReturnValue(true);
            const manager = new DeviceManager(mockedEventEmitter, connectedDevices, settingsManager, mockedLogger);

            const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());
            await connectDevice(manager, deviceInfo, device);
            expect(manager.getConnectedDevices()).toHaveLength(1);

            const disabledSettings = new Settings();
            disabledSettings.addKnownDevice(new KnownDevice(deviceId, 'Foo', 'test', 'test', {}, false));
            settingsManager.getSettings.mockReturnValue(disabledSettings);

            await manager.onSettingsChanged();

            expect(manager.getConnectedDevices()).toHaveLength(0);
        });

        it('leaves devices belonging to still-enabled known devices connected', async () => {
            const deviceId = DeviceId.create('device-still-enabled');
            const deviceInfo: DeviceDetectionInfo = { type: 'test', detectionId: deviceId };
            const settings = new Settings();
            settings.addKnownDevice(new KnownDevice(deviceId, 'Foo', 'test', 'test', {}, true));

            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(settings);

            const connectedDevices = new Map<string, Device>();
            const mockedEventEmitter = mock<EventEmitter>();
            mockedEventEmitter.emit.mockReturnValue(true);
            const manager = new DeviceManager(mockedEventEmitter, connectedDevices, settingsManager, mockedLogger);

            const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());
            await connectDevice(manager, deviceInfo, device);

            await manager.onSettingsChanged();

            expect(manager.getConnectedDevices()).toHaveLength(1);
        });

        it('re-announces a device rejected by the offer only once its canonical known device gets re-enabled', async () => {
            // The device is detected under a preliminary id, but its final/canonical id (only
            // known after connecting, e.g. a serial number read during a handshake) is different.
            const detectionId = DeviceId.create('device-pending-2-detected');
            const canonicalId = DeviceId.create('device-pending-2-canonical');
            const deviceInfo: DeviceDetectionInfo = { type: 'test', detectionId };

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
            const result = await connectDevice(manager, deviceInfo, device);
            expect(result.successful).toBe(false);

            // Drop the deviceDetected emit from announcing above - only the re-announce below is
            // under test here, same as the original addDevice()-based version of this test.
            mockClear(mockedEventEmitter);

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
            const deviceInfo: DeviceDetectionInfo = { type: 'test', detectionId: deviceId };

            const settings = new Settings();
            settings.addKnownDevice(new KnownDevice(deviceId, 'Foo', 'test', 'test', {}, false));

            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(settings);

            const mockedEventEmitter = mock<EventEmitter>();
            mockedEventEmitter.emit.mockReturnValue(true);

            const manager = new DeviceManager(mockedEventEmitter, new Map(), settingsManager, mockedLogger);

            const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());
            await connectDevice(manager, deviceInfo, device);

            mockClear(mockedEventEmitter);

            await manager.onSettingsChanged();

            expect(mockedEventEmitter.emit).not.toHaveBeenCalled();
        });
    });
});
