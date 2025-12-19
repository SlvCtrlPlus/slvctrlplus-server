import AbstractDeviceUpdater from "../../updater/abstractDeviceUpdater.js";
import PlainToClassSerializer from "../../../serialization/plainToClassSerializer.js";
import Device, {DeviceData} from "../../device.js";
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
        // eslint-disable-next-line guard-for-in -- Because rule doesn't recognize if-continue
        for (const attrKey in rawData) {
            if (!device.getAttributeDefinition(attrKey)) {
                this.logger.warn(`device: ${device.getDeviceId} -> has not attribute named: ${attrKey}`);
                continue;
            }

            const attrStr = rawData[attrKey] as string;
            const deviceLogMsg = `device: ${device.getDeviceId} -> ${attrKey} ${attrStr}`;

            void device.setAttribute(attrKey, attrStr)
                .then(() => this.logger.info(`${deviceLogMsg} -> done`))
                .catch((e: Error) => this.logger.error(`${deviceLogMsg} -> failed: ${e.message}`, e))
        }
    }
}
