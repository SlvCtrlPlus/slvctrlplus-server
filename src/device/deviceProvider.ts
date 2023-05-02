import DeviceManager from "./deviceManager.js";
import EventEmitter from "events";
import Device from "./device.js";

export default abstract class DeviceProvider
{
    protected eventEmitter: EventEmitter;

    protected constructor(eventEmitter: EventEmitter) {
        this.eventEmitter = eventEmitter;
    }

    public abstract init(deviceManager: DeviceManager): void;

    public on(event: 'deviceConnected' | 'deviceDisconnected' | 'deviceRefreshed', listener: (device: Device) => void): this
    {
        this.eventEmitter.on(event, listener);

        return this;
    }
}