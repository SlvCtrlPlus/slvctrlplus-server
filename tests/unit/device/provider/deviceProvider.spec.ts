import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import EventEmitter from 'events';
import DeviceProvider from '../../../../src/device/provider/deviceProvider.js';
import DeviceManager, { DeviceDetectionInfo, DeviceManagerEvent } from '../../../../src/device/deviceManager.js';
import { AnyDevice } from '../../../../src/device/device.js';
import Logger from '../../../../src/logging/Logger.js';
import SettingsManager from '../../../../src/settings/settingsManager.js';
import Settings from '../../../../src/settings/settings.js';
import KnownDevice from '../../../../src/settings/knownDevice.js';
import { DeviceId } from '../../../../src/device/deviceId.js';
import TestDevice from '../testDevice.js';

class TestProvider extends DeviceProvider<DeviceDetectionInfo, AnyDevice>
{
    public doStartCalls = 0;
    public doStopCalls = 0;

    public constructor(deviceManager: DeviceManager = mock<DeviceManager>()) {
        super(deviceManager, mock<Logger>());
    }

    protected canHandleDeviceDetectionInfo(_deviceDetectionInfo: DeviceDetectionInfo): _deviceDetectionInfo is DeviceDetectionInfo {
        return false;
    }

    protected createDevice(deviceDetectionInfo: DeviceDetectionInfo): Promise<AnyDevice> {
        return Promise.resolve(new TestDevice(deviceDetectionInfo.detectionId, 'Foo', new Date(), false, new EventEmitter()));
    }

    protected override async doStart(): Promise<void> {
        this.doStartCalls++;
    }

    protected override async doStop(): Promise<void> {
        this.doStopCalls++;
    }
}

// Actually handles detection, so restart tests can prove detected devices are added again -
// not just that start()/stop()/doStart()/doStop() bookkeeping runs.
class DetectingTestProvider extends DeviceProvider<DeviceDetectionInfo, AnyDevice>
{
    public constructor(deviceManager: DeviceManager) {
        super(deviceManager, mock<Logger>());
    }

    protected canHandleDeviceDetectionInfo(deviceDetectionInfo: DeviceDetectionInfo): deviceDetectionInfo is DeviceDetectionInfo {
        return deviceDetectionInfo.type === 'test';
    }

    protected createDevice(deviceDetectionInfo: DeviceDetectionInfo): Promise<AnyDevice> {
        return Promise.resolve(new TestDevice(deviceDetectionInfo.detectionId, 'Foo', new Date(), false, new EventEmitter()));
    }

    // Exposes the protected getConnectedDevice() so tests can check the provider's own
    // bookkeeping directly, e.g. from within a deviceManager event listener.
    public hasDeviceLocally(deviceId: DeviceId): boolean {
        return undefined !== this.getConnectedDevice(deviceId);
    }
}

// createDevice() resolution is controlled from outside via the injected promise, to simulate a
// slow connect attempt that's still in flight when the provider gets stopped.
class SlowCreateDeviceProvider extends DeviceProvider<DeviceDetectionInfo, AnyDevice>
{
    public constructor(deviceManager: DeviceManager, private readonly createDevicePromise: Promise<AnyDevice>) {
        super(deviceManager, mock<Logger>());
    }

    protected canHandleDeviceDetectionInfo(deviceDetectionInfo: DeviceDetectionInfo): deviceDetectionInfo is DeviceDetectionInfo {
        return deviceDetectionInfo.type === 'test';
    }

    protected createDevice(_deviceDetectionInfo: DeviceDetectionInfo): Promise<AnyDevice> {
        return this.createDevicePromise;
    }
}

// Tracks onConnectFailed() calls so tests can assert it does/doesn't run for a given rejection.
class TrackingTestProvider extends DeviceProvider<DeviceDetectionInfo, AnyDevice>
{
    public onConnectFailedCalls = 0;

    public constructor(
        deviceManager: DeviceManager,
        private readonly createDeviceFn: (deviceDetectionInfo: DeviceDetectionInfo) => Promise<AnyDevice>
    ) {
        super(deviceManager, mock<Logger>());
    }

    protected canHandleDeviceDetectionInfo(deviceDetectionInfo: DeviceDetectionInfo): deviceDetectionInfo is DeviceDetectionInfo {
        return deviceDetectionInfo.type === 'test';
    }

    protected createDevice(deviceDetectionInfo: DeviceDetectionInfo): Promise<AnyDevice> {
        return this.createDeviceFn(deviceDetectionInfo);
    }

    protected override async onConnectFailed(_deviceDetectionInfo: DeviceDetectionInfo): Promise<void> {
        this.onConnectFailedCalls++;
    }
}

describe('DeviceProvider', () => {
    it('subscribes to deviceDetected exactly once across repeated start() calls while running', async () => {
        const deviceManager = mock<DeviceManager>();
        const provider = new TestProvider(deviceManager);

        await provider.start();
        await provider.start();

        expect(deviceManager.on).toHaveBeenCalledTimes(1);
        // doStart() itself still runs on every call - subclasses re-entering start() while
        // running (e.g. a reconnect loop) are responsible for making their own logic idempotent
        expect(provider.doStartCalls).toBe(2);
    });

    it('unsubscribes from deviceDetected exactly once when stopped', async () => {
        const deviceManager = mock<DeviceManager>();
        const provider = new TestProvider(deviceManager);

        await provider.start();
        await provider.stop();

        expect(deviceManager.off).toHaveBeenCalledTimes(1);
    });

    describe('restart', () => {
        it('can be started again after being stopped', async () => {
            const deviceManager = mock<DeviceManager>();
            const provider = new TestProvider(deviceManager);

            await provider.start();
            await provider.stop();

            await expect(provider.start()).resolves.toBeUndefined();
        });

        it('re-subscribes to deviceDetected on restart', async () => {
            const deviceManager = mock<DeviceManager>();
            const provider = new TestProvider(deviceManager);

            await provider.start();
            await provider.stop();
            await provider.start();

            expect(deviceManager.on).toHaveBeenCalledTimes(2);
            expect(deviceManager.off).toHaveBeenCalledTimes(1);
        });

        it('resumes detecting and adding devices after a stop() -> start() cycle', async () => {
            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(undefined); // every device enabled by default

            const logger = mock<Logger>();
            logger.child.mockReturnValue(logger);

            const deviceManager = new DeviceManager(new EventEmitter(), settingsManager, logger);
            const provider = new DetectingTestProvider(deviceManager);

            await provider.start();
            deviceManager.announceDetectedDevice({ type: 'test', detectionId: DeviceId.create('device-a') });
            await vi.waitFor(() => expect(deviceManager.getConnectedDevices()).toHaveLength(1));

            await provider.stop();
            // stop() closes connected devices, which removes them from the device manager too
            expect(deviceManager.getConnectedDevices()).toHaveLength(0);

            await provider.start();
            deviceManager.announceDetectedDevice({ type: 'test', detectionId: DeviceId.create('device-b') });

            // If `stopped` were not reset by start(), handleDeviceDetection() would abort this
            // detection immediately and the device would never be added.
            await vi.waitFor(() => expect(deviceManager.getConnectedDevices()).toHaveLength(1));
        });
    });

    describe('handleDeviceDetection', () => {
        it('has the device in its own connected list by the time deviceManager emits deviceConnected', async () => {
            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(undefined);

            const logger = mock<Logger>();
            logger.child.mockReturnValue(logger);

            const deviceManager = new DeviceManager(new EventEmitter(), settingsManager, logger);
            const provider = new DetectingTestProvider(deviceManager);
            await provider.start();

            const deviceId = DeviceId.create('device-race');
            let sawItLocallyOnConnect = false;

            deviceManager.on(DeviceManagerEvent.deviceConnected, (device) => {
                if (device.getDeviceId === deviceId) {
                    sawItLocallyOnConnect = provider.hasDeviceLocally(deviceId);
                }
            });

            deviceManager.announceDetectedDevice({ type: 'test', detectionId: deviceId });

            await vi.waitFor(() => expect(deviceManager.getConnectedDevices()).toHaveLength(1));

            expect(sawItLocallyOnConnect).toBe(true);
        });

        it('closes and does not register a device that connects after the provider was stopped', async () => {
            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(undefined);

            const logger = mock<Logger>();
            logger.child.mockReturnValue(logger);

            const deviceManager = new DeviceManager(new EventEmitter(), settingsManager, logger);

            let resolveCreateDevice!: (device: AnyDevice) => void;
            const createDevicePromise = new Promise<AnyDevice>((resolve) => { resolveCreateDevice = resolve; });

            const provider = new SlowCreateDeviceProvider(deviceManager, createDevicePromise);
            await provider.start();

            deviceManager.announceDetectedDevice({ type: 'test', detectionId: DeviceId.create('device-stopped') });

            // Provider is stopped while createDevice() is still pending
            await provider.stop();

            const device = new TestDevice(DeviceId.create('device-stopped'), 'Foo', new Date(), false, new EventEmitter());
            const closeSpy = vi.spyOn(device, 'close');

            resolveCreateDevice(device);

            await vi.waitFor(() => expect(closeSpy).toHaveBeenCalled());

            expect(deviceManager.getConnectedDevices()).toHaveLength(0);
        });

        it('calls onConnectFailed when the offer itself throws', async () => {
            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(undefined);

            const logger = mock<Logger>();
            logger.child.mockReturnValue(logger);

            const deviceManager = new DeviceManager(new EventEmitter(), settingsManager, logger);
            const provider = new TrackingTestProvider(deviceManager, () => Promise.reject(new Error('connect failed')));

            await provider.start();
            deviceManager.announceDetectedDevice({ type: 'test', detectionId: DeviceId.create('device-throw') });

            await vi.waitFor(() => expect(provider.onConnectFailedCalls).toBe(1));
        });

        it('does not call onConnectFailed when the device is rejected for being disabled', async () => {
            const deviceId = DeviceId.create('device-disabled-oncf');
            const settings = new Settings();
            settings.addKnownDevice(new KnownDevice(deviceId, 'Foo', 'test', 'test', {}, false));

            const settingsManager = mock<SettingsManager>();
            settingsManager.getSettings.mockReturnValue(settings);

            const logger = mock<Logger>();
            logger.child.mockReturnValue(logger);

            const deviceManager = new DeviceManager(new EventEmitter(), settingsManager, logger);

            let closeSpy: ReturnType<typeof vi.spyOn> | undefined;
            const provider = new TrackingTestProvider(
                deviceManager,
                (deviceDetectionInfo) => {
                    const device = new TestDevice(deviceDetectionInfo.detectionId, 'Foo', new Date(), false, new EventEmitter());
                    closeSpy = vi.spyOn(device, 'close');
                    return Promise.resolve(device);
                }
            );

            await provider.start();
            deviceManager.announceDetectedDevice({ type: 'test', detectionId: deviceId });

            // Disabled devices are closed internally by offerDevice() once rejected - wait for
            // that deterministically instead of a fixed sleep.
            await vi.waitFor(() => expect(closeSpy).toHaveBeenCalled());

            expect(deviceManager.getConnectedDevices()).toHaveLength(0);
            expect(provider.onConnectFailedCalls).toBe(0);
        });
    });
});
