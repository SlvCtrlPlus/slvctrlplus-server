
import ButtplugIoDevice from "./buttplugIoDevice.js";
import Device from "../../device.js";
import {DeviceData} from "../../types.js";
import PlainToClassSerializer from "../../../serialization/plainToClassSerializer.js";
import AbstractDeviceUpdater from "../../updater/abstractDeviceUpdater.js";
import Logger from "../../../logging/Logger.js";

export default class ButtplugIoDeviceUpdater extends AbstractDeviceUpdater
{
    private logger: Logger;

    public constructor(serializer: PlainToClassSerializer, logger: Logger) {
        super(serializer);

        this.logger = logger;
    }

    public update(device: Device, rawData: DeviceData): void {
        // Queue update for later to not reject if device is busy
        for (const attrKey in rawData) {
            if (!rawData.hasOwnProperty(attrKey)) {
                continue;
            }

            const attrStr = rawData[attrKey] as string;
            const deviceLogMsg = `device: ${device.getDeviceId} -> ${attrKey} ${attrStr}`;

            void (device as ButtplugIoDevice).setAttribute(attrKey, attrStr)
                .then(() => this.logger.info(`${deviceLogMsg} -> done`))
                .catch((e: Error) => this.logger.error(`${deviceLogMsg} -> failed: ${e.message}`, e))
        }
    }
}
