import Device from "./device.js";
import EventEmitter from "events";
import DeviceProvider from "./provider/deviceProvider.js";
import DeviceManagerEvent from "./deviceManagerEvent.js";
import DeviceProviderEvent from "./provider/deviceProviderEvent.js";
import DeviceEvent from "./deviceEvent.js";
import Logger from "../logging/Logger.js";

export default class DeviceManager
{
    private readonly eventEmitter: EventEmitter;

    private connectedDevices: Map<string, Device>;

    private deviceProviders: DeviceProvider[] = [];

    private readonly logger: Logger;

    public constructor(eventEmitter: EventEmitter, connectedDevices: Map<string, Device>, logger: Logger) {
        this.eventEmitter = eventEmitter;
        this.connectedDevices = connectedDevices;
        this.logger = logger;
    }

    public async registerDeviceProvider(deviceProvider: DeviceProvider): Promise<void>
    {
        deviceProvider.on(DeviceProviderEvent.deviceConnected, (device: Device) => this.addDevice(device));
        deviceProvider.on(DeviceProviderEvent.deviceDisconnected, (device: Device) => this.removeDevice(device));

        this.deviceProviders.push(deviceProvider);

        await deviceProvider.init(this);
    }

    public addDevice(device: Device): void
    {
        device.on(DeviceEvent.deviceError, (d: Device, e: Error) => {
            this.logger.error(`Error for device ${d.getDeviceId}: ${e.message}`, e);
        });

        device.on(DeviceEvent.deviceRefreshed, (d: Device) => this.refreshDevice(d))

        this.connectedDevices.set(device.getDeviceId, device);
        this.eventEmitter.emit(DeviceManagerEvent.deviceConnected, device);
    }

    public removeDevice(device: Device): void
    {
        this.connectedDevices.delete(device.getDeviceId);
        this.eventEmitter.emit(DeviceManagerEvent.deviceDisconnected, device);
    }

    private refreshDevice(device: Device)
    {
        this.eventEmitter.emit(DeviceManagerEvent.deviceRefreshed, device);
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

    public on(event: DeviceManagerEvent, listener: (device: Device) => void): void
    {
        this.eventEmitter.on(event, listener);
    }

    public async close(): Promise<void>
    {
        for (const p of this.deviceProviders) {
            await p.close();
        }
    }
}
