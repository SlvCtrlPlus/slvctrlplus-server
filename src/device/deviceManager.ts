import Device, { DeviceAttributes, DeviceEvent, DeviceNotification, DeviceNotifications } from './device.js';
import EventEmitter from 'events';
import DeviceState from './deviceState.js';
import { setIntervalAsync } from '../util/async.js';
import Logger from '../logging/Logger.js';
import { AnyDeviceConfig } from './deviceConfig.js';
import { logError } from '../util/error.js';

export enum DeviceManagerEvent {
    deviceConnected = 'deviceConnected',
    deviceDisconnected = 'deviceDisconnected',
    deviceRefreshed = 'deviceRefreshed',
    deviceNotification = 'deviceNotification',
}

type DeviceManagerEventMap = {
    [DeviceManagerEvent.deviceConnected]: [device: Device];
    [DeviceManagerEvent.deviceDisconnected]: [device: Device];
    [DeviceManagerEvent.deviceRefreshed]: [device: Device];
    [DeviceManagerEvent.deviceNotification]: [device: Device, notification: DeviceNotification];
}

/**
 * Registry of currently connected devices, plus the refresh scheduling and lifecycle events
 * (connected/disconnected/refreshed/notification) consumed by sockets and automation scripts.
 *
 * Detection/arbitration between competing device providers is no longer this class's concern -
 * each transport-level DeviceProvider (SerialDeviceProvider, BleDeviceProvider, ...) now owns its
 * own discovery and decides for itself, in-process, which registered protocol factory (if any)
 * gets to claim a newly discovered device.
 */
export default class DeviceManager
{
    private readonly eventEmitter: EventEmitter;

    private readonly logger: Logger;

    private readonly connectedDevices: Map<string, Device<any, any>>;

    public constructor(eventEmitter: EventEmitter, connectedDevices: Map<string, Device>, logger: Logger) {
        this.eventEmitter = eventEmitter;
        this.logger = logger.child({ name: DeviceManager.name });
        this.connectedDevices = connectedDevices;
    }

    public addDevice<TAttrs extends DeviceAttributes, TNotifications extends DeviceNotifications, TConfig extends AnyDeviceConfig>(
        device: Device<TAttrs, TNotifications, TConfig>
    ): void
    {
        this.connectedDevices.set(device.getDeviceId, device);

        device.on(DeviceEvent.deviceRefreshed, (d) => this.refreshDevice(d));
        device.on(DeviceEvent.deviceDisconnected, (d) => this.removeDevice(d));
        device.on(DeviceEvent.deviceNotification, (d, notification) => this.eventEmitter.emit(DeviceManagerEvent.deviceNotification, d, notification));

        this.initDeviceRefresher(device);

        this.eventEmitter.emit(DeviceManagerEvent.deviceConnected, device);
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

        if (undefined !== closeError) {
            throw closeError;
        }
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
