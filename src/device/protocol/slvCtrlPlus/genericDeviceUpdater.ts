import AbstractDeviceUpdater from "../../updater/abstractDeviceUpdater.js";
import PlainToClassSerializer from "../../../serialization/plainToClassSerializer.js";
import Device from "../../device.js";
import {DeviceData} from "../../types.js";
import Logger from "../../../logging/Logger.js";

export default class GenericDeviceUpdater extends AbstractDeviceUpdater
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
            const deviceLogMsg = `device: ${device.getDeviceId} -> set-${attrKey} ${attrStr}`;

            void device.setAttribute(attrKey, attrStr)
                .then(() => this.logger.info(`${deviceLogMsg} -> done`))
                .catch((e: Error) => this.logger.warn(`${deviceLogMsg} -> failed: ${e.message}`))
        }
    }
}
