import Device from "./device.js";
import EventEmitter from "events";
import DeviceProvider from "./deviceProvider.js";
import DeviceEventType from "./deviceEventType.js";

export default class DeviceManager extends EventEmitter
{
    private connectedDevices: Map<string, Device> = new Map();

    private deviceProviders: DeviceProvider[] = [];

    public constructor() {
        super();
    }

    public registerDeviceProvider(deviceProvider: DeviceProvider): void
    {
        deviceProvider.on(DeviceEventType.deviceConnected, (device: Device) => this.addDevice(device));
        deviceProvider.on(DeviceEventType.deviceDisconnected, (device: Device) => this.removeDevice(device));
        deviceProvider.on(DeviceEventType.deviceRefreshed, (device: Device) => this.refreshDevice(device));

        this.deviceProviders.push(deviceProvider);

        deviceProvider.init(this);
    }

    public addDevice(device: Device): void
    {
        this.connectedDevices.set(device.getDeviceId, device);
        this.emit('deviceConnected', device);
    }

    public removeDevice(device: Device): void
    {
        this.connectedDevices.delete(device.getDeviceId);
        this.emit('deviceDisconnected', device);
    }

    public refreshDevice(device: Device)
    {
        this.emit('deviceRefreshed', device);
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
}
