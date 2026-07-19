import { AnyDevice, DeviceEvent, DeviceNotification } from './device.js';
import EventEmitter from 'events';
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
     * Devices that were announced as detected while belonging to a disabled known device (or
     * whose registration was rejected by `addDevice()` after connecting, for protocols where the
     * final device id can only be determined post-handshake). Re-announced once their known
     * device gets (re-)enabled, see `onSettingsChanged()`.
     *
     * `canonicalId` is the id whose enablement gates the retry: it is the device's final,
     * canonical id (which may differ from the preliminary `deviceInfo.detectionId` for protocols
     * that only learn their real id during a handshake), so a retry only happens once *that*
     * device is enabled - not on every unrelated settings change. `deviceInfo` is what gets
     * re-announced.
     */
    private readonly pendingDisabledDevices: Map<DeviceId, { deviceInfo: DeviceDetectionInfo, canonicalId: DeviceId }> = new Map();

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
            // At announcement time no connection has happened yet, so the preliminary detection id
            // is the only id we have; it also doubles as the canonical id here.
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
        // A device that has physically disappeared should no longer be retried once its known
        // device gets re-enabled, so drop any pending-retry entry alongside the acquire queue.
        // The pending map is keyed by the preliminary detection id (deviceInfo.detectionId).
        this.pendingDisabledDevices.delete(deviceInfo.detectionId);
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
     * Registers a fully connected device, unless the known device it belongs to (identified by
     * its final `getDeviceId`) has been disabled - in that case, the device is closed right away
     * and never registered. Returns whether the device was actually added.
     *
     * `deviceInfo` is the original info this device was detected with (as passed to
     * `announceDetectedDevice()`), used to resolve that pipeline's bookkeeping: claiming it on
     * success, or releasing it and registering it for retry on rejection.
     */
    public addDevice(deviceInfo: DeviceDetectionInfo, device: AnyDevice): boolean
    {
        if (!this.isDeviceEnabled(device.getDeviceId)) {
            this.logger.info(`Not adding device '${device.getDeviceId}' since it is disabled`);
            device.close().catch((e: unknown) => logError(this.logger, `Failed to close disabled device '${device.getDeviceId}'`, e));

            // The final, canonical id (device.getDeviceId) is the one that was found disabled and
            // must therefore gate the retry - not the preliminary detection id.
            this.registerPendingRetry(deviceInfo, device.getDeviceId);
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

    /**
     * Registers a device for retry once the known device identified by `canonicalId` gets
     * (re-)enabled. Keyed by the preliminary detection id so `revokeDetectedDevice()` (which only
     * has that id) can still drop it when the device disappears.
     */
    private registerPendingRetry(deviceInfo: DeviceDetectionInfo, canonicalId: DeviceId): void {
        this.pendingDisabledDevices.set(deviceInfo.detectionId, { deviceInfo, canonicalId });
    }

    public async onSettingsChanged(): Promise<void> {
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

        for (const [detectionId, { deviceInfo, canonicalId }] of this.pendingDisabledDevices) {
            if (!this.isDeviceEnabled(canonicalId)) {
                continue;
            }

            this.pendingDisabledDevices.delete(detectionId);
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

        this.pendingDisabledDevices.clear();

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
