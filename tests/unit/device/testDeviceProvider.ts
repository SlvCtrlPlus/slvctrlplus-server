import {EventEmitter} from "events";
import DeviceProvider from "../../../src/device/provider/deviceProvider.js";

export default class TestDeviceProvider extends DeviceProvider
{
    public constructor(eventEmitter: EventEmitter)
    {
        super(eventEmitter);
    }

    public init(): Promise<void>
    {
        // noop
        return new Promise<void>((resolve) => resolve());
    }
}
