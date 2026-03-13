import Device, { DeviceAttributes, DeviceEvent } from './device.js';
import EventEmitter from 'events';
import { PortInfo } from '@serialport/bindings-interface';
import { Peripheral } from '@stoprocent/noble';
import DeviceState from './deviceState.js';
import { setIntervalAsync } from '../util/async.js';
import Logger from '../logging/Logger.js';
import { AnyDeviceConfig } from './deviceConfig.js';

export type DeviceInfo = {
    id: string;
};

export type SerialDeviceInfo = DeviceInfo & {
    portInfo: PortInfo;
};

export type BleDeviceInfo = DeviceInfo & {
    peripheral: Peripheral;
};

export enum DeviceManagerEvent {
    deviceConnected = 'deviceConnected',
    deviceDisconnected = 'deviceDisconnected',
    deviceRefreshed = 'deviceRefreshed',
    deviceDetected = 'deviceAvailable',
}

type ClaimResult =
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

    private readonly availableDeviceClaimQueue: Map<string, { resolve: (value: ClaimResult) => void }[]> = new Map();

    private readonly connectedDevices: Map<string, Device>;

    public constructor(eventEmitter: EventEmitter, connectedDevices: Map<string, Device>, logger: Logger) {
        this.eventEmitter = eventEmitter;
        this.logger = logger;
        this.connectedDevices = connectedDevices;
    }

    public addAvailableDevice(deviceInfo: DeviceInfo): void
    {
        if (this.availableDeviceClaimQueue.has(deviceInfo.id)) {
            return;
        }

        this.availableDeviceClaimQueue.set(deviceInfo.id, []);

        // announce it to the device providers so they can try to connect to it
        this.eventEmitter.emit('deviceAvailable', deviceInfo);
    }

    public async acquireAvailableDevice(deviceId: string): Promise<ClaimResult>
    {
        return new Promise<ClaimResult>((resolve) => {
            const deviceQueue = this.availableDeviceClaimQueue.get(deviceId);

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

    public releaseAvailableDevice(deviceId: string): void
    {
        const deviceQueue = this.availableDeviceClaimQueue.get(deviceId);

        if (undefined === deviceQueue) {
            return;
        }

        // Release current claimant and hand off the claim to the next waiter
        deviceQueue.shift();

        if (deviceQueue.length === 0) {
            this.availableDeviceClaimQueue.delete(deviceId);
            return;
        }

        deviceQueue[0]?.resolve({ successful: true });
    }

    public addDevice<TAttrs extends DeviceAttributes, TConfig extends AnyDeviceConfig>(
        device: Device<TAttrs, TConfig>
    ): void
    {
        this.connectedDevices.set(device.getDeviceId, device);

        device.on(DeviceEvent.deviceRefreshed, (d: Device) => this.refreshDevice(d));
        device.on(DeviceEvent.deviceDisconnected, (d: Device) => this.removeDevice(d));

        this.initDeviceRefresher(device);

        this.eventEmitter.emit('deviceConnected', device);
    }

    public claimAvailableDevice(deviceId: string): void
    {
        for (const entry of this.availableDeviceClaimQueue.get(deviceId) ?? []) {
            entry.resolve({ successful: false, reason: `Device with id '${deviceId}' has been claimed by another provider` });
        }

        this.availableDeviceClaimQueue.delete(deviceId);
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

    private initDeviceRefresher(device: Device): void {
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
            timeoutMs: 500,
            onError: (e: unknown) => this.logger.error(`device: ${device.getDeviceId} -> refresh -> failed: ${(e as Error).message}`),
        });

        device.on(DeviceEvent.deviceDisconnected, () => deviceRefreshInterval.clear());
    }

    private removeDevice(device: Device): void
    {
        this.connectedDevices.delete(device.getDeviceId);
        this.eventEmitter.emit('deviceDisconnected', device);
    }

    private refreshDevice(device: Device): void
    {
        this.eventEmitter.emit('deviceRefreshed', device);
    }
}
