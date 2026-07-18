import Device, { DeviceAttributes, DeviceEvent, DeviceNotification, DeviceNotifications } from './device.js';
import EventEmitter from 'events';
import DeviceState from './deviceState.js';
import { setIntervalAsync } from '../util/async.js';
import Logger from '../logging/Logger.js';
import { AnyDeviceConfig } from './deviceConfig.js';
import { logError } from '../util/error.js';
import { DeviceId } from './deviceId.js';
import SettingsManager from '../settings/settingsManager.js';

export type DeviceInfo = {
    type: string;
    id: DeviceId;
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
    [DeviceManagerEvent.deviceConnected]: [device: Device];
    [DeviceManagerEvent.deviceDisconnected]: [device: Device];
    [DeviceManagerEvent.deviceRefreshed]: [device: Device];
    [DeviceManagerEvent.deviceDetected]: [deviceInfo: DeviceInfo];
    [DeviceManagerEvent.deviceNotification]: [device: Device, notification: DeviceNotification];
}

export default class DeviceManager
{
    private readonly eventEmitter: EventEmitter;

    private readonly logger: Logger;

    private readonly detectedDeviceAcquireQueue: Map<string, { resolve: (value: AcquireResult) => void }[]> = new Map();

    private readonly connectedDevices: Map<string, Device<any, any>>;

    private readonly settingsManager: SettingsManager;

    /**
     * Devices that were announced as detected while belonging to a disabled known device (or
     * whose registration was rejected by `addDevice()` after connecting, for protocols where the
     * final device id can only be determined post-handshake). Re-announced once their known
     * device gets (re-)enabled, see `onSettingsChanged()`.
     */
    private readonly pendingDisabledDevices: Map<DeviceId, DeviceInfo> = new Map();

    public constructor(
        eventEmitter: EventEmitter,
        connectedDevices: Map<string, Device>,
        settingsManager: SettingsManager,
        logger: Logger
    ) {
        this.eventEmitter = eventEmitter;
        this.logger = logger.child({ name: DeviceManager.name });
        this.connectedDevices = connectedDevices;
        this.settingsManager = settingsManager;
    }

    /**
     * This is the single, authoritative place deciding whether a known device is currently
     * allowed to be connected. Any protocol-specific id assigned before a device's identity is
     * fully resolved (e.g. during a handshake) may differ from its final, canonical device id
     * (`Device.getDeviceId`), so this check is only truly reliable once called with that final
     * id - which is exactly what `addDevice()` does below. Callers with only a preliminary id
     * (e.g. providers deciding whether it's worth attempting a connection at all) may still use
     * this as a best-effort optimization, but must not treat a resulting `true` as a guarantee.
     */
    public isDeviceEnabled(deviceId: DeviceId): boolean {
        return this.settingsManager.getSettings()?.getKnownDeviceById(deviceId)?.enabled ?? true;
    }

    public announceDetectedDevice(deviceInfo: DeviceInfo): void
    {
        if (this.detectedDeviceAcquireQueue.has(deviceInfo.id)) {
            return;
        }

        if (this.connectedDevices.has(deviceInfo.id)) {
            this.logger.debug(`Device with id '${deviceInfo.id}' is already connected, not announcing it as detected`);
            return;
        }

        if (!this.isDeviceEnabled(deviceInfo.id)) {
            this.logger.debug(`Device with id '${deviceInfo.id}' is disabled, not announcing it as detected`);
            this.pendingDisabledDevices.set(deviceInfo.id, deviceInfo);
            return;
        }

        this.logger.info(`Detected new device with id ${deviceInfo.id}`);

        this.detectedDeviceAcquireQueue.set(deviceInfo.id, []);

        const hadListeners = this.eventEmitter.emit(DeviceManagerEvent.deviceDetected, deviceInfo);

        if (!hadListeners) {
            // no subscribed providers, remove empty list from acquire queue for this device
            this.logger.info(`No provider available for detected device with id '${deviceInfo.id}'`);
            this.detectedDeviceAcquireQueue.delete(deviceInfo.id);
        }
    }

    public revokeDetectedDevice(deviceInfo: DeviceInfo): void
    {
        this.clearDetectedDeviceAcquireQueue(deviceInfo.id, `Device with id '${deviceInfo.id}' has disappeared`);
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
    public addDevice<TAttrs extends DeviceAttributes, TNotifications extends DeviceNotifications, TConfig extends AnyDeviceConfig>(
        deviceInfo: DeviceInfo,
        device: Device<TAttrs, TNotifications, TConfig>
    ): boolean
    {
        if (!this.isDeviceEnabled(device.getDeviceId)) {
            this.logger.info(`Not adding device '${device.getDeviceId}' since it is disabled`);
            void device.close().catch((e: unknown) => logError(this.logger, `Failed to close disabled device '${device.getDeviceId}'`, e));

            this.registerPendingRetry(deviceInfo);
            this.releaseDetectedDevice(deviceInfo.id);

            return false;
        }

        this.connectedDevices.set(device.getDeviceId, device);

        device.on(DeviceEvent.deviceRefreshed, (d) => this.refreshDevice(d));
        device.on(DeviceEvent.deviceDisconnected, (d) => this.removeDevice(d));
        device.on(DeviceEvent.deviceNotification, (d, notification) => this.eventEmitter.emit(DeviceManagerEvent.deviceNotification, d, notification));

        this.initDeviceRefresher(device);

        this.eventEmitter.emit(DeviceManagerEvent.deviceConnected, device);

        this.claimDetectedDevice(deviceInfo.id);

        return true;
    }

    /**
     * Registers a device for retry once its known device gets (re-)enabled. Used internally by
     * `addDevice()` when it rejects a device whose known device turned out to be disabled.
     */
    private registerPendingRetry(deviceInfo: DeviceInfo): void {
        this.pendingDisabledDevices.set(deviceInfo.id, deviceInfo);
    }

    /**
     * Closes any currently connected device whose known device has since been disabled, and
     * re-announces any previously rejected device whose known device has since been (re-)enabled
     * - letting it run through the exact same detection pipeline as a brand new device. Should be
     * called whenever settings change.
     */
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

        for (const [deviceId, deviceInfo] of this.pendingDisabledDevices) {
            if (!this.isDeviceEnabled(deviceId)) {
                continue;
            }

            this.pendingDisabledDevices.delete(deviceId);
            this.announceDetectedDevice(deviceInfo);
        }
    }

    public claimDetectedDevice(deviceId: DeviceId): void
    {
        this.clearDetectedDeviceAcquireQueue(deviceId, `Device with id '${deviceId}' has been claimed by another provider`);
    }

    public getConnectedDevices(): Device<any, any>[]
    {
        return Array.from(this.connectedDevices.values());
    }

    public getConnectedDevice(deviceId: string): Device|null
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

    private initDeviceRefresher(device: Device<any, any>): void {
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

    private removeDevice(device: Device<any, any, any>): void
    {
        this.connectedDevices.delete(device.getDeviceId);
        this.eventEmitter.emit(DeviceManagerEvent.deviceDisconnected, device);
    }

    private refreshDevice(device: Device<any, any, any>): void
    {
        this.eventEmitter.emit(DeviceManagerEvent.deviceRefreshed, device);
    }
}
