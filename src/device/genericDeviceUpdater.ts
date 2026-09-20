import type { AnyDevice, DeviceData, DeviceDataUpdateResult } from './device.js';
import type DeviceUpdaterInterface from './updater/deviceUpdaterInterface.js';
import type Logger from '../logging/Logger.js';
import { logError } from '../util/error.js';
import DeviceDataValidationError from './deviceDataValidationError.js';

export default class GenericDeviceUpdater implements DeviceUpdaterInterface
{
    private readonly logger: Logger;

    private readonly failedMessageCountPerDevice = new Map<string, number>();

    public constructor(logger: Logger) {
        this.logger = logger.child({ name: GenericDeviceUpdater.name });
    }

    public async update(device: AnyDevice, data: DeviceData): Promise<DeviceDataUpdateResult> {
        const deviceLogMsg = `device: ${device.getDeviceId} -> ${JSON.stringify(data)}`;

        try {
            const result = await device.updateDeviceData(data);

            if (result.errors.length > 0) {
                this.logger.warn(`${deviceLogMsg} -> completed with ${result.errors.length} error(s)`);
                for (const error of result.errors) {
                    this.logger.warn(`  ${error.path}: ${error.message}`);
                }
            } else {
                this.logger.info(`${deviceLogMsg} -> done`);
            }

            this.failedMessageCountPerDevice.delete(device.getDeviceId);

            return result;
        } catch (e: unknown) {
            // Validation errors propagate to callers (controller → 400)
            if (e instanceof DeviceDataValidationError) {
                throw e;
            }

            logError(this.logger, `${deviceLogMsg} -> failed`, e);

            const failedMessageCount = (this.failedMessageCountPerDevice.get(device.getDeviceId) ?? 0) + 1;
            this.failedMessageCountPerDevice.set(device.getDeviceId, failedMessageCount);

            if (failedMessageCount % 10 === 0) {
                this.logger.warn(`Device ${device.getDeviceId} has ${failedMessageCount} failed update attempts`);
            }

            throw e;
        }
    }
}
