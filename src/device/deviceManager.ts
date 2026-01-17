import Device from "./device.js";
import EventEmitter from "events";
import DeviceProvider from "./provider/deviceProvider.js";
import DeviceManagerEvent from "./deviceManagerEvent.js";
import DeviceProviderEvent from "./provider/deviceProviderEvent.js";

export default class DeviceManager
{
    private eventEmitter: EventEmitter;

    private connectedDevices: Map<string, Device>;

    private deviceProviders: DeviceProvider[] = [];

    public constructor(eventEmitter: EventEmitter, connectedDevices: Map<string, Device>) {
        this.eventEmitter = eventEmitter;
        this.connectedDevices = connectedDevices;
    }

    public registerDeviceProvider(deviceProvider: DeviceProvider): void
    {
        deviceProvider.on(DeviceProviderEvent.deviceConnected, (device: Device) => this.addDevice(device));
        deviceProvider.on(DeviceProviderEvent.deviceDisconnected, (device: Device) => this.removeDevice(device));
        deviceProvider.on(DeviceProviderEvent.deviceRefreshed, (device: Device) => this.refreshDevice(device));

        this.deviceProviders.push(deviceProvider);
    }

    public addDevice(device: Device): void
    {
        this.connectedDevices.set(device.getDeviceId, device);
        this.eventEmitter.emit(DeviceManagerEvent.deviceConnected, device);
    }

    public removeDevice(device: Device): void
    {
        this.connectedDevices.delete(device.getDeviceId);
        this.eventEmitter.emit(DeviceManagerEvent.deviceDisconnected, device);
    }

    public refreshDevice(device: Device)
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
}
