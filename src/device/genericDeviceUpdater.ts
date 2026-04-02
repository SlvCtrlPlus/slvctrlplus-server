import AbstractDeviceUpdater from './updater/abstractDeviceUpdater.js';
import PlainToClassSerializer from '../serialization/plainToClassSerializer.js';
import Device, { DeviceData } from './device.js';
import Logger from '../logging/Logger.js';
import { getTypedKeys } from '../util/objects.js';
import { logError } from '../util/error.js';

export default class GenericDeviceUpdater extends AbstractDeviceUpdater
{
    private logger: Logger;

    private readonly failedMessageCountPerDevice: Map<string, number> = new Map();

    public constructor(serializer: PlainToClassSerializer, logger: Logger) {
        super(serializer);

        this.logger = logger.child({ name: GenericDeviceUpdater.name });
    }

    public async update(device: Device, rawData: DeviceData): Promise<void> {
        let hadFailure = false;

        // Queue update for later to not reject if device is busy
        for (const attrKey of getTypedKeys(rawData)) {
            if (undefined === await device.getAttribute(attrKey)) {
                this.logger.warn(`device: ${device.getDeviceId} -> has no attribute named: ${attrKey}`);
                continue;
            }

            const attrStr = rawData[attrKey];
            const deviceLogMsg = `device: ${device.getDeviceId} -> ${attrKey} ${attrStr}`;

            try {
                await device.setAttribute(attrKey, attrStr);
                this.logger.info(`${deviceLogMsg} -> done`);
            } catch(e: unknown) {
                hadFailure = true;

                logError(this.logger, `${deviceLogMsg} -> failed`, e);
            }
        }

        if (hadFailure) {
            const failedMessageCount = (this.failedMessageCountPerDevice.get(device.getDeviceId) ?? 0) + 1;
            this.failedMessageCountPerDevice.set(device.getDeviceId, failedMessageCount);

            if (failedMessageCount % 10 === 0) {
                this.logger.warn(`Device ${device.getDeviceId} has ${failedMessageCount} failed update attempts`);
            }
        } else {
            this.failedMessageCountPerDevice.delete(device.getDeviceId);
        }
    }
}
