import AbstractDeviceUpdater from "../abstractDeviceUpdater.js";
import PlainToClassSerializer from "../../serialization/plainToClassSerializer.js";
import Device from "../device.js";
import {DeviceData} from "../types";
import GenericDevice from "./genericDevice";

export default class GenericDeviceUpdater extends AbstractDeviceUpdater
{
    public constructor(serializer: PlainToClassSerializer) {
        super(serializer);
    }

    public update(device: Device, rawData: DeviceData): void {
        // Queue update for later to not reject if device is busy
        const data = rawData as JsonObject;

        for (const attrKey in data) {
            if (!data.hasOwnProperty(attrKey)) {
                continue;
            }
            void (device as GenericDevice).setAttribute(attrKey, data[attrKey] as string)
                .then(() => console.log(`device: ${device.getDeviceId} -> set mode: ${(device as GenericDevice).getAttribute(attrKey)} (done)`));
        }
    }
}
