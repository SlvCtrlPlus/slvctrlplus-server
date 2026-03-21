import Device, { DeviceAttributes, DeviceEvent } from './device.js';
import EventEmitter from 'events';
import DeviceState from './deviceState.js';
import { setIntervalAsync } from '../util/async.js';
import Logger from '../logging/Logger.js';
import { AnyDeviceConfig } from './deviceConfig.js';
import { logError } from '../util/error.js';
import DeviceId from './deviceId.js';

export type DeviceInfo = {
    id: DeviceId;
};

export enum DeviceManagerEvent {
    deviceConnected = 'deviceConnected',
    deviceDisconnected = 'deviceDisconnected',
    deviceRefreshed = 'deviceRefreshed',
    deviceDetected = 'deviceDetected',
}

type AcquireResult =
    | { successful: true }
    | { successful: false, reason: string };

type DeviceManagerEventMap = {
    [DeviceManagerEvent.deviceConnected]: [device: Device];
    [DeviceManagerEvent.deviceDisconnected]: [device: Device];
    [DeviceManagerEvent.deviceRefreshed]: [device: Device];
    [DeviceManagerEvent.deviceDetected]: [deviceInfo: DeviceInfo];
}

export default class DeviceManager
{
    private readonly eventEmitter: EventEmitter;

    private readonly logger: Logger;

    private readonly detectedDeviceAcquireQueue: Map<string, { resolve: (value: AcquireResult) => void }[]> = new Map();

    private readonly connectedDevices: Map<string, Device>;

    public constructor(eventEmitter: EventEmitter, connectedDevices: Map<string, Device>, logger: Logger) {
        this.eventEmitter = eventEmitter;
        this.logger = logger;
        this.connectedDevices = connectedDevices;
    }

    public announceDetectedDevice(deviceInfo: DeviceInfo): void
    {
        if (this.detectedDeviceAcquireQueue.has(deviceInfo.id.toString())) {
            return;
        }

        this.logger.info(`Announced new BLE device with id ${deviceInfo.id.toString()}`);

        this.detectedDeviceAcquireQueue.set(deviceInfo.id.toString(), []);

        const hadListeners = this.eventEmitter.emit(DeviceManagerEvent.deviceDetected, deviceInfo);

        if (!hadListeners) {
            // no subscribed providers, remove empty list from acquire queue for this device
            this.logger.info(`No provider available for detected device with id '${deviceInfo.id.toString()}'`);
            this.detectedDeviceAcquireQueue.delete(deviceInfo.id.toString());
        }
    }

    public revokeDetectedDevice(deviceInfo: DeviceInfo): void
    {
        this.clearDetectedDeviceAcquireQueue(deviceInfo.id, `Device with id '${deviceInfo.id.toString()}' has disappeared`);
    }

    public async acquireDetectedDevice(deviceId: DeviceId): Promise<AcquireResult>
    {
        return new Promise<AcquireResult>((resolve) => {
            const deviceQueue = this.detectedDeviceAcquireQueue.get(deviceId.toString());

            if (undefined === deviceQueue) {
                resolve({ successful: false, reason: `Device with id '${deviceId.toString()}' is not available for claiming` });
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
        const deviceQueue = this.detectedDeviceAcquireQueue.get(deviceId.toString());

        if (undefined === deviceQueue) {
            return;
        }

        // Release current claimant and hand off the claim to the next waiter
        deviceQueue.shift();

        if (deviceQueue.length === 0) {
            this.detectedDeviceAcquireQueue.delete(deviceId.toString());
            return;
        }

        deviceQueue[0]?.resolve({ successful: true });
    }

    public addDevice<TAttrs extends DeviceAttributes, TConfig extends AnyDeviceConfig>(
        device: Device<TAttrs, TConfig>
    ): void
    {
        this.connectedDevices.set(device.getDeviceId.toString(), device);

        device.on(DeviceEvent.deviceRefreshed, (d: Device) => this.refreshDevice(d));
        device.on(DeviceEvent.deviceDisconnected, (d: Device) => this.removeDevice(d));

        this.initDeviceRefresher(device);

        this.eventEmitter.emit(DeviceManagerEvent.deviceConnected, device);
    }

    public claimDetectedDevice(deviceId: DeviceId): void
    {
        this.clearDetectedDeviceAcquireQueue(deviceId, `Device with id '${deviceId.toString()}' has been claimed by another provider`);
    }

    public getConnectedDevices(): Device[]
    {
        return Array.from(this.connectedDevices.values());
    }

    public getConnectedDevice(uuid: string): Device|null
    {
        const device = this.connectedDevices.get(uuid);

        return undefined !== device ? device : null;
    }

    public on<T extends DeviceManagerEvent>(
        event: T,
        listener: (...args: DeviceManagerEventMap[T]) => void
    ): void
    {
        this.eventEmitter.on(event, listener);
    }

    private clearDetectedDeviceAcquireQueue(deviceId: DeviceId, reason: string): void
    {
        for (const entry of this.detectedDeviceAcquireQueue.get(deviceId.toString()) ?? []) {
            entry.resolve({ successful: false, reason });
        }

        this.detectedDeviceAcquireQueue.delete(deviceId.toString());
    }

    private initDeviceRefresher(device: Device): void {
        this.logger.info(`Initializing refresher for device '${device.getDeviceName}' (id: ${device.getDeviceId.toString()})`);
        const deviceRefreshIntervalMs = device.getRefreshInterval;

        if (undefined === deviceRefreshIntervalMs) {
            return;
        }

        const deviceRefresher = async (): Promise<void> => {
            if (device.getState === DeviceState.busy) {
                this.logger.trace(`Device not refreshed since it's currently busy: ${device.getDeviceId.toString()}`);
                return;
            }

            await device.refresh();

            this.logger.trace(`device: ${device.getDeviceId.toString()} -> refresh -> successful`);
        };

        const deviceRefreshInterval = setIntervalAsync(deviceRefresher, {
            intervalMs: deviceRefreshIntervalMs,
            timeoutMs: deviceRefreshIntervalMs * 3,
            onError: (e: unknown) => logError(this.logger, `device: ${device.getDeviceId.toString()} -> refresh -> failed`, e),
        });

        device.on(DeviceEvent.deviceDisconnected, () => deviceRefreshInterval.clear());
    }

    private removeDevice(device: Device): void
    {
        this.connectedDevices.delete(device.getDeviceId.toString());
        this.eventEmitter.emit(DeviceManagerEvent.deviceDisconnected, device);
    }

    private refreshDevice(device: Device): void
    {
        this.eventEmitter.emit(DeviceManagerEvent.deviceRefreshed, device);
    }
}
