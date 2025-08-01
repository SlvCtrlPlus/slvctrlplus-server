import DeviceProvider from "./deviceProvider.js";
import EventEmitter from "events";
import Logger from "../../logging/Logger.js";
import SerialPortObserver from "../transport/serialPortObserver.js";
import {PortInfo} from "@serialport/bindings-interface";

export default abstract class SerialDeviceProvider extends DeviceProvider
{
    protected constructor(eventEmitter: EventEmitter, logger: Logger) {
        super(eventEmitter, logger);
    }

    public async init(): Promise<void>
    {
        return Promise.resolve();
    }

    public abstract connectToDevice(portInfo: PortInfo): Promise<boolean>;

    public registerAtObserver(observer: SerialPortObserver): void
    {
        observer.addDeviceProvider(this);
    }
}
