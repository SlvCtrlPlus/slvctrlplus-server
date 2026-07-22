import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import EventEmitter from 'events';
import DeviceProvider from '../../../../src/device/provider/deviceProvider.js';
import DeviceManager, { DeviceDetectionInfo } from '../../../../src/device/deviceManager.js';
import { AnyDevice } from '../../../../src/device/device.js';
import Logger from '../../../../src/logging/Logger.js';
import SettingsManager from '../../../../src/settings/settingsManager.js';
import { DeviceId } from '../../../../src/device/deviceId.js';
import TestDevice from '../testDevice.js';

class TestProvider extends DeviceProvider<DeviceDetectionInfo, AnyDevice>
{
    public doStartCalls = 0;
    public doStopCalls = 0;

    public constructor(deviceManager: DeviceManager = mock<DeviceManager>()) {
        super(deviceManager, new EventEmitter(), mock<Logger>());
    }

    protected canHandleDeviceDetectionInfo(_deviceDetectionInfo: DeviceDetectionInfo): _deviceDetectionInfo is DeviceDetectionInfo {
        return false;
    }

    protected createDevice(_deviceDetectionInfo: DeviceDetectionInfo): Promise<AnyDevice | undefined> {
        return Promise.resolve(undefined);
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
        super(deviceManager, new EventEmitter(), mock<Logger>());
    }

    protected canHandleDeviceDetectionInfo(deviceDetectionInfo: DeviceDetectionInfo): deviceDetectionInfo is DeviceDetectionInfo {
        return deviceDetectionInfo.type === 'test';
    }

    protected createDevice(deviceDetectionInfo: DeviceDetectionInfo): Promise<AnyDevice | undefined> {
        return Promise.resolve(new TestDevice(deviceDetectionInfo.detectionId, 'Foo', new Date(), false, new EventEmitter()));
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

            const deviceManager = new DeviceManager(new EventEmitter(), new Map(), settingsManager, logger);
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
});
