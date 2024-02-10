import DeviceManager from "../deviceManager.js";
import EventEmitter from "events";
import Device from "../device.js";
import DeviceProviderEvent from "./deviceProviderEvent.js";
import Logger from "../../logging/Logger.js";

export default abstract class DeviceProvider
{
    protected readonly eventEmitter: EventEmitter;

    protected readonly logger: Logger;

    protected constructor(eventEmitter: EventEmitter, logger: Logger) {
        this.eventEmitter = eventEmitter;
        this.logger = logger;
    }

    public abstract init(deviceManager: DeviceManager): Promise<void>;

    public abstract close(): Promise<void>;

    public on(event: DeviceProviderEvent, listener: (device: Device) => void): DeviceProvider
    {
        this.eventEmitter.on(event, listener);

        return this;
    }
}
