import PlainToClassSerializer from "../serialization/plainToClassSerializer.js";
import DeviceUpdaterInterface from "./deviceUpdaterInterface.js";
import Device from "./device.js";
import {DeviceData} from "./types";

export default abstract class AbstractDeviceUpdater implements DeviceUpdaterInterface
{
    protected serializer: PlainToClassSerializer;

    protected constructor(serializer: PlainToClassSerializer)
    {
        this.serializer = serializer;
    }

    public abstract update(device: Device, deviceData: DeviceData): void;
}
