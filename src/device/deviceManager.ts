import { AnyDevice, DeviceEvent, DeviceNotification } from './device.js';
import EventEmitter from 'events';
import { SequentialTaskQueue } from 'sequential-task-queue';
import DeviceState from './deviceState.js';
import { setIntervalAsync } from '../util/async.js';
import Logger from '../logging/Logger.js';
import { logError } from '../util/error.js';
import { DeviceId } from './deviceId.js';
import SettingsManager from '../settings/settingsManager.js';
import DeviceOfferRejectedError from './deviceOfferRejectedError.js';

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

type OfferResult<D extends AnyDevice> =
    | { successful: true, device: D }
    | { successful: false, reason: unknown };

type QueueEntry<D extends AnyDevice> = {
    deviceDetectionInfo: DeviceDetectionInfo;
    deviceOffer: () => Promise<D | undefined>;
    resolve: (result: OfferResult<D>) => void;
};

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

    private readonly detectedDeviceOfferQueue: Map<string, QueueEntry<any>[]> = new Map();

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
        if (this.detectedDeviceOfferQueue.has(deviceInfo.detectionId)) {
            return;
        }

        if (this.connectedDevices.has(deviceInfo.detectionId)) {
            this.logger.debug(`Device with id '${deviceInfo.detectionId}' is already connected, not announcing it as detected`);
            return;
        }

        this.logger.info(`Detected new device with id ${deviceInfo.detectionId}`);

        this.detectedDeviceOfferQueue.set(deviceInfo.detectionId, []);

        const hadListeners = this.eventEmitter.emit(DeviceManagerEvent.deviceDetected, deviceInfo);

        if (!hadListeners) {
            // no subscribed providers, remove empty list from offer queue for this device
            this.logger.info(`No provider available for detected device with id '${deviceInfo.detectionId}'`);
            this.detectedDeviceOfferQueue.delete(deviceInfo.detectionId);
        }
    }

    public revokeDetectedDevice(deviceInfo: DeviceDetectionInfo): void
    {
        // A device that physically disappeared should no longer be retried on re-enable
        this.pendingRetries.delete(deviceInfo.detectionId);
        this.clearDetectedDeviceOfferQueue(deviceInfo.detectionId, `Device with id '${deviceInfo.detectionId}' has disappeared`);
    }

    public offerDevice<D extends AnyDevice>(deviceDetectionInfo: DeviceDetectionInfo, deviceOffer: () => Promise<D | undefined>): Promise<OfferResult<D>>
    {
        return new Promise<OfferResult<D>>((resolve) => {
            const deviceQueue = this.detectedDeviceOfferQueue.get(deviceDetectionInfo.detectionId);

            if (undefined === deviceQueue) {
                resolve({ successful: false, reason: new DeviceOfferRejectedError(`Device with id '${deviceDetectionInfo.detectionId}' is not available anymore for offering`) });
                return;
            }

            // Always add to queue first
            deviceQueue.push({ deviceDetectionInfo, deviceOffer, resolve });

            // If we're first in line, run our offer immediately
            if (deviceQueue.length === 1) {
                void this.runNextInQueue(deviceQueue);
            }
        });
    }

    private addDevice(deviceInfo: DeviceDetectionInfo, device: AnyDevice): boolean
    {
        if (!this.isDeviceEnabled(device.getDeviceId)) {
            this.logger.info(`Not adding device '${device.getDeviceId}' since it is disabled`);

            const closingDevice = device.close()
                .catch((e: unknown) => logError(this.logger, `Failed to close disabled device '${device.getDeviceId}'`, e));

            // Keyed by detection id so revokeDetectedDevice() (which only has that id) can drop it
            this.pendingRetries.set(deviceInfo.detectionId, { deviceInfo, canonicalId: device.getDeviceId, closingDevice });

            return false;
        }

        this.connectedDevices.set(device.getDeviceId, device);

        device.on(DeviceEvent.deviceRefreshed, (d) => this.eventEmitter.emit(DeviceManagerEvent.deviceRefreshed, d));
        device.on(DeviceEvent.deviceDisconnected, (d) => {
            this.connectedDevices.delete(d.getDeviceId);
            this.eventEmitter.emit(DeviceManagerEvent.deviceDisconnected, d);
        });
        device.on(DeviceEvent.deviceNotification, (d, notification) => this.eventEmitter.emit(DeviceManagerEvent.deviceNotification, d, notification));

        this.initDeviceRefresher(device);

        this.eventEmitter.emit(DeviceManagerEvent.deviceConnected, device);

        return true;
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

        for (const [deviceId] of this.detectedDeviceOfferQueue) {
            this.clearDetectedDeviceOfferQueue(deviceId, 'Device manager reset');
        }

        this.pendingRetries.clear();

        if (undefined !== closeError) {
            throw closeError;
        }
    }

    private async runNextInQueue<D extends AnyDevice>(deviceQueue: QueueEntry<D>[]): Promise<void>
    {
        const entry = deviceQueue[0];

        if (undefined === entry) {
            return;
        }

        const detectionId = entry.deviceDetectionInfo.detectionId;

        const rejectAndAdvance = (reason: unknown): void => {
            entry.resolve({ successful: false, reason });
            this.advanceQueue(detectionId, deviceQueue);
        };

        try {
            const device = await entry.deviceOffer();

            if (undefined === device) {
                rejectAndAdvance(new Error(`Device offer for '${detectionId}' returned undefined`));
                return;
            }

            // The queue may have been cleared (revoke/reset) or replaced (a fresh announce for
            // the same detection id) while this offer was in flight - the caller already got a
            // settled result for the old queue, so don't hand it a device it never asked for.
            if (this.detectedDeviceOfferQueue.get(detectionId) !== deviceQueue) {
                await device.close()
                    .catch((e: unknown) => logError(this.logger, `Failed to close device '${device.getDeviceId}' offered after its queue was cleared`, e));
                return;
            }

            const added = this.addDevice(entry.deviceDetectionInfo, device);

            if (added) {
                entry.resolve({ successful: true, device });
                this.clearDetectedDeviceOfferQueue(detectionId, `Device '${detectionId}' has been claimed by another provider`);
                return;
            }

            rejectAndAdvance(new DeviceOfferRejectedError(`Device '${device.getDeviceId}' is disabled, not added`));
        } catch (e: unknown) {
            rejectAndAdvance(e);
        }
    }

    /**
     * Drops the just-settled entry and hands off to the next waiter, if any. Deletes the queue
     * entirely once empty so the device can be re-announced (announceDetectedDevice() gates on
     * the map key existing).
     */
    private advanceQueue<D extends AnyDevice>(detectionId: string, deviceQueue: QueueEntry<D>[]): void
    {
        // The queue may already have been cleared/replaced (revoke, reset, or a fresh announce
        // for the same detection id) - don't shift/delete a queue we no longer own.
        if (this.detectedDeviceOfferQueue.get(detectionId) !== deviceQueue) {
            return;
        }

        deviceQueue.shift();

        if (deviceQueue.length === 0) {
            this.detectedDeviceOfferQueue.delete(detectionId);
            return;
        }

        void this.runNextInQueue(deviceQueue);
    }

    private clearDetectedDeviceOfferQueue(deviceId: string, reason: string): void
    {
        for (const entry of this.detectedDeviceOfferQueue.get(deviceId) ?? []) {
            entry.resolve({ successful: false, reason: new DeviceOfferRejectedError(reason) });
        }

        this.detectedDeviceOfferQueue.delete(deviceId);
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
}
