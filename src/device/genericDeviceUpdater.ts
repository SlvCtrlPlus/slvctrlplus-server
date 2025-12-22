import AbstractDeviceUpdater from "./updater/abstractDeviceUpdater.js";
import PlainToClassSerializer from "../serialization/plainToClassSerializer.js";
import Device, {DeviceData} from "./device.js";
import Logger from "../logging/Logger.js";

export default class GenericDeviceUpdater extends AbstractDeviceUpdater
{
    private logger: Logger;

    public constructor(serializer: PlainToClassSerializer, logger: Logger) {
        super(serializer);

        this.logger = logger;
    }

    public async update(device: Device, rawData: DeviceData): Promise<void> {
        // Queue update for later to not reject if device is busy
        for (const attrKey of Object.keys(rawData)) {
            if (!await device.getAttribute(attrKey)) {
                this.logger.warn(`device: ${device.getDeviceId} -> has no attribute named: ${attrKey}`);
                continue;
            }

            const attrStr = rawData[attrKey] as string;
            const deviceLogMsg = `device: ${device.getDeviceId} -> ${attrKey} ${attrStr}`;

            await device.setAttribute(attrKey, attrStr)
                .then(() => this.logger.info(`${deviceLogMsg} -> done`))
                .catch((e: Error) => this.logger.error(`${deviceLogMsg} -> failed: ${e.message}`, e))
        }
    }
}
