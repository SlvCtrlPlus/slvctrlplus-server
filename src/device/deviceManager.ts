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
    deviceAvailable = 'deviceAvailable',
}

type DeviceManagerEventMap = {
    [DeviceManagerEvent.deviceConnected]: [device: Device];
    [DeviceManagerEvent.deviceDisconnected]: [device: Device];
    [DeviceManagerEvent.deviceRefreshed]: [device: Device];
    [DeviceManagerEvent.deviceAvailable]: [deviceInfo: DeviceInfo];
}

export default class DeviceManager
{
    private readonly eventEmitter: EventEmitter;

    private readonly logger: Logger;

    private readonly availableDevices: Map<string, DeviceInfo> = new Map();

    private readonly deviceClaimQueue: Map<string, {resolve: () => void, reject: (reason?: any) => void}[]> = new Map();

    private readonly connectedDevices: Map<string, Device>;

    public constructor(eventEmitter: EventEmitter, connectedDevices: Map<string, Device>, logger: Logger) {
        this.eventEmitter = eventEmitter;
        this.logger = logger;
        this.connectedDevices = connectedDevices;
    }

    public addAvailableDevice(deviceInfo: DeviceInfo): void
    {
        this.availableDevices.set(deviceInfo.id, deviceInfo);
        this.deviceClaimQueue.set(deviceInfo.id, []);

        // announce it to the device providers so they can try to connect to it
        this.eventEmitter.emit('deviceAvailable', deviceInfo);
    }

    public async claimAvailableDevice(deviceId: string): Promise<void>
    {
        return new Promise<void>((resolve, reject) => {
            const deviceQueue = this.deviceClaimQueue.get(deviceId);

            if (undefined === deviceQueue) {
                reject(new Error(`Device with id '${deviceId}' is not available for claiming`));
                return;
            }

            // Always add to queue first
            deviceQueue.push({ resolve, reject });

            // If we're first in line, resolve immediately
            if (deviceQueue.length === 1) {
                resolve();
            }
        });
    }

    public freeClaimedDevice(deviceId: string): void
    {
        const deviceQueue = this.deviceClaimQueue.get(deviceId);

        if (undefined === deviceQueue) {
            return;
        }

        // Release current claimant and hand off the claim to the next waiter
        deviceQueue.shift();

        if (deviceQueue.length === 0) {
            return;
        }

        deviceQueue[0]?.resolve();
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

        for (const entry of this.deviceClaimQueue.get(device.getDeviceId) ?? []) {
            entry.reject(new Error(`Device with id '${device.getDeviceId}' has been claimed by another provider`));
        }

        this.deviceClaimQueue.delete(device.getDeviceId);
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

        const deviceRefresher = async () => {
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

    private refreshDevice(device: Device)
    {
        this.eventEmitter.emit('deviceRefreshed', device);
    }
}
