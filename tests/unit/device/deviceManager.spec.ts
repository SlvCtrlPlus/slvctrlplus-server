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

    // Configures a mocked EventEmitter to synchronously react to deviceDetected the way a real
    // DeviceProvider does (see DeviceProvider.handleDeviceDetection(), which calls offerDevice()
    // synchronously within its own emit() dispatch) - announceDetectedDevice()'s post-emit
    // offerQueue.has() check depends on this happening synchronously, which a bare mock doesn't
    // do on its own.
    const reactToDetection = (mockedEventEmitter: ReturnType<typeof mock<EventEmitter>>, reaction: () => void) => {
        mockedEventEmitter.emit.mockImplementation((event: string | symbol) => {
            if (event === DeviceManagerEvent.deviceDetected) {
                reaction();
            }
            return true;
        });
    };

    // Announces the device and immediately offers it for connection, simulating a provider that
    // synchronously reacts to the announcement - the only way to get a device registered through
    // the public API now that addDevice() is private.
    const connectDevice = (manager: DeviceManager, mockedEventEmitter: ReturnType<typeof mock<EventEmitter>>, deviceInfo: DeviceDetectionInfo, device: AnyDevice) => {
        let offerPromise!: ReturnType<DeviceManager['offerDevice']>;

        reactToDetection(mockedEventEmitter, () => {
            offerPromise = manager.offerDevice(deviceInfo, () => Promise.resolve(device));
        });

        manager.announceDetectedDevice(deviceInfo);

        return offerPromise;
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
        await connectDevice(deviceManager, mockedDeviceManagerEventEmitter, deviceInfo, device);

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

        await connectDevice(deviceManager, mockedDeviceManagerEventEmitter, deviceInfo, device);
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

        await connectDevice(deviceManager, mockedDeviceManagerEventEmitter, deviceInfo, device);
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

        it('does not re-announce a device while an offer for it is still in flight', () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedSettingsManager, mockedLogger);

            // Offer never settles on its own, so the queue is still legitimately open (an offer
            // is genuinely in progress) when the second announce comes in - that's what's under
            // test here, distinct from the "nothing ever offered" behavior below.
            reactToDetection(mockedEventEmitter, () => {
                void manager.offerDevice(deviceInfo, () => new Promise<AnyDevice>(() => {}));
            });

            manager.announceDetectedDevice(deviceInfo);
            manager.announceDetectedDevice(deviceInfo);

            expect(mockedEventEmitter.emit).toHaveBeenCalledOnce();
            expect(mockedEventEmitter.emit).toHaveBeenCalledWith(DeviceManagerEvent.deviceDetected, deviceInfo);
        });

        it('allows re-announcing a device after it was revoked (tombstone must not permanently block it)', () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedSettingsManager, mockedLogger);

            mockedEventEmitter.emit.mockReturnValue(true);
            manager.announceDetectedDevice(deviceInfo);

            // Device physically disappears - revoke() leaves a closed tombstone behind (not a
            // plain delete) so a late offer arriving after this point still rejects itself.
            manager.revokeDetectedDevice(deviceInfo);

            mockClear(mockedEventEmitter);
            mockedEventEmitter.emit.mockReturnValue(true);

            // Genuine redetection (e.g. replugged) must not be blocked by that leftover
            // tombstone - dropIfRevoked() has to run before the has() reentrancy guard sees it.
            manager.announceDetectedDevice(deviceInfo);

            expect(mockedEventEmitter.emit).toHaveBeenCalledWith(DeviceManagerEvent.deviceDetected, deviceInfo);
        });

        it('does not emit event when device is already connected', () => {
            const connectedDevices = new Map<string, Device>([[deviceId, mock<Device>()]]);
            const manager = new DeviceManager(mockedEventEmitter, connectedDevices, mockedSettingsManager, mockedLogger);

            manager.announceDetectedDevice(deviceInfo);

            expect(mockedEventEmitter.emit).not.toHaveBeenCalled();
        });

        it('still allows a later offer to succeed on its own after no listeners responded to deviceDetected', async () => {
            mockedEventEmitter.emit.mockReturnValue(false);
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedSettingsManager, mockedLogger);

            manager.announceDetectedDevice(deviceInfo);

            // announceDetectedDevice() no longer opens/reserves anything proactively - offer()
            // lazily opens its own queue, so a provider calling offerDevice() later succeeds
            // rather than being told the device is "not available anymore".
            const result = await manager.offerDevice(deviceInfo, () => Promise.resolve(new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter())));
            expect(result.successful).toBe(true);
        });

        it('discards the queue and allows re-announcing when listeners exist but none of them offer a device', () => {
            // Simulates a subscribed provider whose canHandleDeviceDetectionInfo() declines this
            // detection's type, so it never calls offerDevice() - hadListeners is true, but
            // nothing ever offers.
            mockedEventEmitter.emit.mockReturnValue(true);
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedSettingsManager, mockedLogger);

            manager.announceDetectedDevice(deviceInfo);

            mockClear(mockedEventEmitter);
            mockedEventEmitter.emit.mockReturnValue(true);

            manager.announceDetectedDevice(deviceInfo);

            expect(mockedEventEmitter.emit).toHaveBeenCalledWith(DeviceManagerEvent.deviceDetected, deviceInfo);
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

        it('runs the first offer immediately and adds the device on success', async () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedSettingsManager, mockedLogger);

            const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());
            const result = await connectDevice(manager, mockedEventEmitter, deviceInfo, device);

            expect(result).toStrictEqual({ successful: true, device });
            expect(manager.getConnectedDevices()).toContain(device);
        });

        it('clears the queue and re-allows announcing after the only offer fails', async () => {
            const manager = new DeviceManager(mockedEventEmitter, new Map(), mockedSettingsManager, mockedLogger);

            let resultPromise!: ReturnType<DeviceManager['offerDevice']>;
            reactToDetection(mockedEventEmitter, () => {
                resultPromise = manager.offerDevice(deviceInfo, () => Promise.reject(new Error('connect failed')));
            });

            manager.announceDetectedDevice(deviceInfo);
            await resultPromise;

            mockClear(mockedEventEmitter);
            mockedEventEmitter.emit.mockReturnValue(true);

            manager.announceDetectedDevice(deviceInfo);

            expect(mockedEventEmitter.emit).toHaveBeenCalledWith(DeviceManagerEvent.deviceDetected, deviceInfo);
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

        it('drops a disabled device from pending retry so it is not re-announced after re-enabling', async () => {
            const settings = new Settings();
            settings.addKnownDevice(new KnownDevice(deviceId, 'Foo', 'test', 'test', {}, false));

            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(settings);

            const manager = new DeviceManager(mockedEventEmitter, new Map(), settingsManager, mockedLogger);

            // Announced (detection id happens to match the disabled known device) - the provider
            // still gets a chance to offer it, but addDevice() rejects it once connected since
            // it's disabled, parking it in pending retry.
            const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());
            const result = await connectDevice(manager, mockedEventEmitter, deviceInfo, device);
            expect(result.successful).toBe(false);

            mockClear(mockedEventEmitter);

            // Device physically disappears while still disabled.
            manager.revokeDetectedDevice(deviceInfo);

            // Re-enabling it must NOT resurrect the gone device.
            settings.addKnownDevice(new KnownDevice(deviceId, 'Foo', 'test', 'test', {}, true));
            await manager.onSettingsChanged();

            expect(mockedEventEmitter.emit).not.toHaveBeenCalled();
        });

        it('does not park a device for retry if it was revoked while the offer was still connecting', async () => {
            const settings = new Settings();
            settings.addKnownDevice(new KnownDevice(deviceId, 'Foo', 'test', 'test', {}, false));

            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(settings);

            const manager = new DeviceManager(mockedEventEmitter, new Map(), settingsManager, mockedLogger);

            let resolveOffer!: (device: AnyDevice) => void;
            const offerPromise = new Promise<AnyDevice>((resolve) => { resolveOffer = resolve; });
            let offerStarted = false;
            let resultPromise!: ReturnType<DeviceManager['offerDevice']>;

            reactToDetection(mockedEventEmitter, () => {
                resultPromise = manager.offerDevice(deviceInfo, () => {
                    offerStarted = true;
                    return offerPromise;
                });
            });

            manager.announceDetectedDevice(deviceInfo);

            // Wait for the connect attempt to actually start before revoking, to genuinely
            // simulate a revoke while it's in flight rather than while it's still merely queued.
            await vi.waitFor(() => expect(offerStarted).toBe(true));

            // Device physically disappears while the (disabled) device is still connecting.
            manager.revokeDetectedDevice(deviceInfo);

            // The connect attempt only succeeds now, after the revoke already settled the caller.
            const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());
            resolveOffer(device);

            const result = await resultPromise;
            expect(result.successful).toBe(false);

            mockClear(mockedEventEmitter);
            mockedEventEmitter.emit.mockReturnValue(true);

            // Re-enabling it must NOT resurrect the gone device - it should never have been
            // parked for retry in the first place, since it was already known to be gone by the
            // time it "connected".
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

            const result = await connectDevice(manager, mockedEventEmitter, deviceInfo, device);

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

            const result = await connectDevice(manager, mockedEventEmitter, deviceInfo, device);

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
            await connectDevice(manager, mockedEventEmitter, deviceInfo, device);
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
            await connectDevice(manager, mockedEventEmitter, deviceInfo, device);

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
            const result = await connectDevice(manager, mockedEventEmitter, deviceInfo, device);
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
            await connectDevice(manager, mockedEventEmitter, deviceInfo, device);

            mockClear(mockedEventEmitter);

            await manager.onSettingsChanged();

            expect(mockedEventEmitter.emit).not.toHaveBeenCalled();
        });
    });
});
