import { AnyDevice, DeviceEvent, DeviceNotification } from './device.js';
import EventEmitter from 'events';
import { SequentialTaskQueue } from 'sequential-task-queue';
import DeviceState from './deviceState.js';
import { setIntervalAsync } from '../util/async.js';
import Logger from '../logging/Logger.js';
import { logError } from '../util/error.js';
import { DeviceId } from './deviceId.js';
import SettingsManager from '../settings/settingsManager.js';

export type DeviceDetectionInfo = {
    type: string;
    detectionId: DeviceId;
};

export enum DeviceManagerEvent {
    deviceConnected = 'deviceConnected',
    deviceDisconnected = 'deviceDisconnected',
    deviceRefreshed = 'deviceRefreshed',
    deviceDetected = 'deviceDetected',
    deviceNotification = 'deviceNotification',
}

type AcquireResult =
    | { successful: true }
    | { successful: false, reason: string };

type DeviceManagerEventMap = {
    [DeviceManagerEvent.deviceConnected]: [device: AnyDevice];
    [DeviceManagerEvent.deviceDisconnected]: [device: AnyDevice];
    [DeviceManagerEvent.deviceRefreshed]: [device: AnyDevice];
    [DeviceManagerEvent.deviceDetected]: [deviceInfo: DeviceDetectionInfo];
    [DeviceManagerEvent.deviceNotification]: [device: AnyDevice, notification: DeviceNotification];
}

export default class DeviceManager
{
    private readonly eventEmitter: EventEmitter;

    private readonly logger: Logger;

    private readonly detectedDeviceAcquireQueue: Map<string, { resolve: (value: AcquireResult) => void }[]> = new Map();

    private readonly connectedDevices: Map<string, AnyDevice>;

    private readonly settingsManager: SettingsManager;

    /**
     * Devices whose retry is pending because their known device is disabled; re-announced once
     * it gets (re-)enabled, see `onSettingsChanged()`. `canonicalId` is the device's final id
     * whose enablement gates the retry (protocols may only learn it during a handshake, so it
     * can differ from the map key, the preliminary `deviceInfo.detectionId`).
     */
    private readonly pendingRetries: Map<DeviceId, { deviceInfo: DeviceDetectionInfo, canonicalId: DeviceId, closingDevice?: Promise<void> }> = new Map();

    // Serializes onSettingsChanged() runs so rapid settings changes don't interleave
    private readonly settingsChangeQueue: SequentialTaskQueue = new SequentialTaskQueue();

    public constructor(
        eventEmitter: EventEmitter,
        connectedDevices: Map<string, AnyDevice>,
        settingsManager: SettingsManager,
        logger: Logger
    ) {
        this.eventEmitter = eventEmitter;
        this.logger = logger.child({ name: DeviceManager.name });
        this.connectedDevices = connectedDevices;
        this.settingsManager = settingsManager;
    }

    public isDeviceEnabled(deviceId: DeviceId): boolean {
        return this.settingsManager.getSettings()?.getKnownDeviceById(deviceId)?.enabled ?? true;
    }

    public announceDetectedDevice(deviceInfo: DeviceDetectionInfo): void
    {
        if (this.detectedDeviceAcquireQueue.has(deviceInfo.detectionId)) {
            return;
        }

        if (this.connectedDevices.has(deviceInfo.detectionId)) {
            this.logger.debug(`Device with id '${deviceInfo.detectionId}' is already connected, not announcing it as detected`);
            return;
        }

        if (!this.isDeviceEnabled(deviceInfo.detectionId)) {
            this.logger.debug(`Device with id '${deviceInfo.detectionId}' is disabled, not announcing it as detected`);
            // No connection happened yet, so the detection id doubles as the canonical id here
            this.registerPendingRetry(deviceInfo, deviceInfo.detectionId);
            return;
        }

        this.logger.info(`Detected new device with id ${deviceInfo.detectionId}`);

        this.detectedDeviceAcquireQueue.set(deviceInfo.detectionId, []);

        const hadListeners = this.eventEmitter.emit(DeviceManagerEvent.deviceDetected, deviceInfo);

        if (!hadListeners) {
            // no subscribed providers, remove empty list from acquire queue for this device
            this.logger.info(`No provider available for detected device with id '${deviceInfo.detectionId}'`);
            this.detectedDeviceAcquireQueue.delete(deviceInfo.detectionId);
        }
    }

    public revokeDetectedDevice(deviceInfo: DeviceDetectionInfo): void
    {
        // A device that physically disappeared should no longer be retried on re-enable
        this.pendingRetries.delete(deviceInfo.detectionId);
        this.clearDetectedDeviceAcquireQueue(deviceInfo.detectionId, `Device with id '${deviceInfo.detectionId}' has disappeared`);
    }

    public async acquireDetectedDevice(deviceId: DeviceId): Promise<AcquireResult>
    {
        return new Promise<AcquireResult>((resolve) => {
            const deviceQueue = this.detectedDeviceAcquireQueue.get(deviceId);

            if (undefined === deviceQueue) {
                resolve({ successful: false, reason: `Device with id '${deviceId}' is not available for claiming` });
                return;
            }

            // Always add to queue first
            deviceQueue.push({ resolve });

            // If we're first in line, resolve immediately
            if (deviceQueue.length === 1) {
                resolve({ successful: true });
            }
        });
    }

    public releaseDetectedDevice(deviceId: DeviceId): void
    {
        const deviceQueue = this.detectedDeviceAcquireQueue.get(deviceId);

        if (undefined === deviceQueue) {
            return;
        }

        // Release current claimant and hand off the claim to the next waiter
        deviceQueue.shift();

        if (deviceQueue.length === 0) {
            this.detectedDeviceAcquireQueue.delete(deviceId);
            return;
        }

        deviceQueue[0]?.resolve({ successful: true });
    }

    /**
     * Registers a fully connected device, unless its known device (identified by the final
     * `getDeviceId`) is disabled - then the device is closed and registered for retry instead.
     * Returns whether the device was added.
     */
    public addDevice(deviceInfo: DeviceDetectionInfo, device: AnyDevice): boolean
    {
        if (!this.isDeviceEnabled(device.getDeviceId)) {
            this.logger.info(`Not adding device '${device.getDeviceId}' since it is disabled`);

            const closingDevice = device.close()
                .catch((e: unknown) => logError(this.logger, `Failed to close disabled device '${device.getDeviceId}'`, e));

            this.registerPendingRetry(deviceInfo, device.getDeviceId, closingDevice);
            this.releaseDetectedDevice(deviceInfo.detectionId);

            return false;
        }

        this.connectedDevices.set(device.getDeviceId, device);

        device.on(DeviceEvent.deviceRefreshed, (d) => this.refreshDevice(d));
        device.on(DeviceEvent.deviceDisconnected, (d) => this.removeDevice(d));
        device.on(DeviceEvent.deviceNotification, (d, notification) => this.eventEmitter.emit(DeviceManagerEvent.deviceNotification, d, notification));

        this.initDeviceRefresher(device);

        this.eventEmitter.emit(DeviceManagerEvent.deviceConnected, device);

        this.claimDetectedDevice(deviceInfo.detectionId);

        return true;
    }

    // Keyed by detection id so revokeDetectedDevice() (which only has that id) can drop it
    private registerPendingRetry(
        deviceInfo: DeviceDetectionInfo,
        canonicalId: DeviceId,
        closingDevice?: Promise<void>
    ): void {
        this.pendingRetries.set(deviceInfo.detectionId, { deviceInfo, canonicalId, closingDevice });
    }

    public async onSettingsChanged(): Promise<void> {
        await this.settingsChangeQueue.push(() => this.applySettingsChange());
    }

    private async applySettingsChange(): Promise<void> {
        for (const device of this.connectedDevices.values()) {
            if (this.isDeviceEnabled(device.getDeviceId)) {
                continue;
            }

            this.logger.info(`Closing device '${device.getDeviceId}' since it has been disabled`);

            try {
                await device.close();
            } catch (e: unknown) {
                logError(this.logger, `Failed to close device '${device.getDeviceId}'`, e);
            }
        }

        for (const [detectionId, { deviceInfo, canonicalId, closingDevice }] of this.pendingRetries) {
            if (!this.isDeviceEnabled(canonicalId)) {
                continue;
            }

            this.pendingRetries.delete(detectionId);

            // Make sure a device rejected by addDevice() has finished closing before re-announcing
            if (undefined !== closingDevice) {
                await closingDevice;
            }

            this.announceDetectedDevice(deviceInfo);
        }
    }

    public claimDetectedDevice(deviceId: DeviceId): void
    {
        this.clearDetectedDeviceAcquireQueue(deviceId, `Device with id '${deviceId}' has been claimed by another provider`);
    }

    public getConnectedDevices(): AnyDevice[]
    {
        return Array.from(this.connectedDevices.values());
    }

    public getConnectedDevice(deviceId: string): AnyDevice|null
    {
        const device = this.connectedDevices.get(deviceId);

        return undefined !== device ? device : null;
    }

    public on<T extends DeviceManagerEvent>(
        event: T,
        listener: (...args: DeviceManagerEventMap[T]) => void
    ): void
    {
        this.eventEmitter.on(event, listener);
    }

    public off<T extends DeviceManagerEvent>(
        event: T,
        listener: (...args: DeviceManagerEventMap[T]) => void
    ): void
    {
        this.eventEmitter.off(event, listener);
    }

    public async reset(): Promise<void>
    {
        let closeError: unknown;

        for (const [, device] of this.connectedDevices) {
            try {
                await device.close();
            } catch (e: unknown) {
                logError(this.logger, `device: ${device.getDeviceId} -> close during reset -> failed`, e);
                if (undefined === closeError) {
                    closeError = e;
                }
            }
        }

        for (const [deviceId] of this.detectedDeviceAcquireQueue) {
            this.clearDetectedDeviceAcquireQueue(deviceId, 'Device manager reset');
        }

        this.pendingRetries.clear();

        if (undefined !== closeError) {
            throw closeError;
        }
    }

    private clearDetectedDeviceAcquireQueue(deviceId: string, reason: string): void
    {
        for (const entry of this.detectedDeviceAcquireQueue.get(deviceId) ?? []) {
            entry.resolve({ successful: false, reason });
        }

        this.detectedDeviceAcquireQueue.delete(deviceId);
    }

    private initDeviceRefresher(device: AnyDevice): void {
        this.logger.info(`Initializing refresher for device '${device.getDeviceName}' (id: ${device.getDeviceId})`);
        const deviceRefreshIntervalMs = device.getRefreshInterval;

        if (undefined === deviceRefreshIntervalMs) {
            return;
        }

        const deviceRefresher = async (): Promise<void> => {
            if (device.getState === DeviceState.busy) {
                this.logger.trace(`Device not refreshed since it's currently busy: ${device.getDeviceId}`);
                return;
            }

            await device.refresh();

            this.logger.trace(`device: ${device.getDeviceId} -> refresh -> successful`);
        };

        const deviceRefreshInterval = setIntervalAsync(deviceRefresher, {
            intervalMs: deviceRefreshIntervalMs,
            timeoutMs: deviceRefreshIntervalMs * 3,
            onError: (e: unknown) => logError(this.logger, `device: ${device.getDeviceId} -> refresh -> failed`, e),
        });

        device.on(DeviceEvent.deviceDisconnected, () => deviceRefreshInterval.clear());
    }

    private removeDevice(device: AnyDevice): void
    {
        this.connectedDevices.delete(device.getDeviceId);
        this.eventEmitter.emit(DeviceManagerEvent.deviceDisconnected, device);
    }

    private refreshDevice(device: AnyDevice): void
    {
        this.eventEmitter.emit(DeviceManagerEvent.deviceRefreshed, device);
    }
}
