import AbstractDeviceUpdater from "../updater/abstractDeviceUpdater.js";
import PlainToClassSerializer from "../../serialization/plainToClassSerializer.js";
import Device from "../device.js";
import {DeviceData} from "../types.js";
import GenericSlvCtrlPlusDevice from "../protocol/slvCtrlPlus/genericSlvCtrlPlusDevice.js";

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

            const attrStr = rawData[attrKey] as string;
            const deviceLogMsg = `device: ${device.getDeviceId} -> set-${attrKey} ${attrStr}`;

            void (device as GenericSlvCtrlPlusDevice).setAttribute(attrKey, attrStr)
                .then(() => console.log(`${deviceLogMsg} -> done`))
                .catch((e: Error) => console.log(`${deviceLogMsg} -> failed: ${e.message}`))
        }
    }
}
