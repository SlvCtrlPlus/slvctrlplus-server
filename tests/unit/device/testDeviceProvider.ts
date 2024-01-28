import {EventEmitter} from "events";
import DeviceProvider from "../../../src/device/provider/deviceProvider.js";
import Logger from "../../../src/logging/Logger.js";

export default class TestDeviceProvider extends DeviceProvider
{
    public constructor(eventEmitter: EventEmitter, logger: Logger)
    {
        super(eventEmitter, logger);
    }

    public init(): Promise<void>
    {
        // noop
        return new Promise<void>((resolve) => resolve());
    }
}
