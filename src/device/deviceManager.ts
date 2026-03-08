import Device from './device.js';
import EventEmitter from 'events';
import DeviceManagerEvents from './deviceManagerEvent.js';
import { PortInfo } from '@serialport/bindings-interface';
import { Peripheral } from '@stoprocent/noble';

export type DeviceInfo = {
    id: string;
};

export type SerialDeviceInfo = DeviceInfo & {
    portInfo: PortInfo;
};

export type BleDeviceInfo = DeviceInfo & {
    peripheral: Peripheral;
};

export default class DeviceManager
{
    private readonly eventEmitter: EventEmitter;

    private readonly availableDevices: Map<string, DeviceInfo> = new Map();

    private readonly deviceClaimQueue: Map<string, {resolve: () => void, reject: (reason?: any) => void}[]> = new Map();

    private readonly connectedDevices: Map<string, Device>;

    public constructor(eventEmitter: EventEmitter, connectedDevices: Map<string, Device>) {
        this.eventEmitter = eventEmitter;
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

        if (undefined === deviceQueue || deviceQueue.length === 0) {
            return;
        }

        deviceQueue.shift()?.resolve();
    }

    public addDevice(device: Device): void
    {
        this.connectedDevices.set(device.getDeviceId, device);
        this.eventEmitter.emit('deviceConnected', device);

        for (const entry of this.deviceClaimQueue.get(device.getDeviceId) ?? []) {
            entry.reject(new Error(`Device with id '${device.getDeviceId}' has been claimed by another provider`));
        }

        this.deviceClaimQueue.delete(device.getDeviceId);
    }

    public removeDevice(device: Device): void
    {
        this.connectedDevices.delete(device.getDeviceId);
        this.eventEmitter.emit('deviceDisconnected', device);
    }

    public refreshDevice(device: Device)
    {
        this.eventEmitter.emit('deviceRefreshed', device);
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

    public on<T extends keyof DeviceManagerEvents>(
        event: T,
        listener: (...args: DeviceManagerEvents[T]) => void
    ): void
    {
        console.log('somebody registered for event: ' + event)
        this.eventEmitter.on(event, listener);
    }
}
