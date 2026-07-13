import {EventEmitter} from "events";
import DeviceProvider from "../../../src/device/provider/deviceProvider.js";
import Logger from "../../../src/logging/Logger.js";
import DeviceManager from "../../../src/device/deviceManager.js";
import { NoDeviceProviderConfig } from "../../../src/device/provider/deviceProviderConfig.js";

export default class TestDeviceProvider extends DeviceProvider<NoDeviceProviderConfig>
{
    public constructor(config: NoDeviceProviderConfig, deviceManager: DeviceManager, eventEmitter: EventEmitter, logger: Logger)
    {
        super(config, deviceManager, eventEmitter, logger);
    }

    public override init(): Promise<void>
    {
        // noop
        return new Promise<void>((resolve) => resolve());
    }
}
