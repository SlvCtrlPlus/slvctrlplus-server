import AbstractDeviceUpdater from "../abstractDeviceUpdater.js";
import PlainToClassSerializer from "../../serialization/plainToClassSerializer.js";
import Device from "../device.js";
import {DeviceData} from "../types.js";
import GenericDevice from "./genericDevice.js";

export default class GenericDeviceUpdater extends AbstractDeviceUpdater
{
    public constructor(serializer: PlainToClassSerializer) {
        super(serializer);
    }

    public update(device: Device, rawData: DeviceData): void {
        // Queue update for later to not reject if device is busy
        for (const attrKey in rawData) {
            if (!rawData.hasOwnProperty(attrKey)) {
                continue;
            }

            void (device as GenericDevice).setAttribute(attrKey, rawData[attrKey] as string)
                .then(() => console.log(`device: ${device.getDeviceId} -> set ${attrKey}: ${(device as GenericDevice).getAttribute(attrKey)} (done)`));
        }
    }
}
