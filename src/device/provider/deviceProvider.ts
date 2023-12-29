import DeviceManager from "../deviceManager.js";
import EventEmitter from "events";
import Device from "../device.js";
import DeviceProviderEvent from "./deviceProviderEvent.js";

export default abstract class DeviceProvider
{
    protected eventEmitter: EventEmitter;

    protected constructor(eventEmitter: EventEmitter) {
        this.eventEmitter = eventEmitter;
    }

    public abstract init(deviceManager: DeviceManager): Promise<void>;

    public on(event: DeviceProviderEvent, listener: (device: Device) => void): DeviceProvider
    {
        this.eventEmitter.on(event, listener);

        return this;
    }
}
