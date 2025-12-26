import AbstractDeviceUpdater from "./updater/abstractDeviceUpdater.js";
import PlainToClassSerializer from "../serialization/plainToClassSerializer.js";
import Device, {DeviceData} from "./device.js";
import Logger from "../logging/Logger.js";
import {getTypedKeys} from "../util/objects.js";

export default class GenericDeviceUpdater extends AbstractDeviceUpdater
{
    private logger: Logger;

    public constructor(serializer: PlainToClassSerializer, logger: Logger) {
        super(serializer);

        this.logger = logger;
    }

    public async update(device: Device, rawData: DeviceData): Promise<void> {
        // Queue update for later to not reject if device is busy
        for (const attrKey of getTypedKeys(rawData)) {
            if (!await device.getAttribute(attrKey)) {
                this.logger.warn(`device: ${device.getDeviceId} -> has no attribute named: ${attrKey}`);
                continue;
            }

            const attrStr = rawData[attrKey];
            const deviceLogMsg = `device: ${device.getDeviceId} -> ${attrKey} ${attrStr}`;

            try {
                await device.setAttribute(attrKey, attrStr)
                this.logger.info(`${deviceLogMsg} -> done`);
            } catch(e: unknown) {
                this.logger.error(`${deviceLogMsg} -> failed: ${(e as Error).message}`, e);
            }
        }
    }
}
