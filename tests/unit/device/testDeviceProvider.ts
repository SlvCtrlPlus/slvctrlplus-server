import {EventEmitter} from "events";
import DeviceProvider from "../../../src/device/provider/deviceProvider.js";
import Logger from "../../../src/logging/Logger.js";
import DeviceManager from "../../../src/device/deviceManager.js";

export default class TestDeviceProvider extends DeviceProvider<Device>
{
    public constructor(deviceManager: DeviceManager, eventEmitter: EventEmitter, logger: Logger)
    {
        super(deviceManager, eventEmitter, logger);
    }

    public override init(): Promise<void>
    {
        // noop
        return new Promise<void>((resolve) => resolve());
    }
}
