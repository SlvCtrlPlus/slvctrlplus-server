import type { AnyDevice, DeviceData } from './device.js';
import type DeviceUpdaterInterface from './updater/deviceUpdaterInterface.js';
import type JsonSchemaValidatorFactory from '../schemaValidation/JsonSchemaValidatorFactory.js';
import type Logger from '../logging/Logger.js';
import { getTypedKeys } from '../util/objects.js';
import { logError } from '../util/error.js';

export default class GenericDeviceUpdater implements DeviceUpdaterInterface
{
    private readonly logger: Logger;

    private readonly validatorFactory: JsonSchemaValidatorFactory;

    private readonly failedMessageCountPerDevice = new Map<string, number>();

    public constructor(validatorFactory: JsonSchemaValidatorFactory, logger: Logger) {
        this.validatorFactory = validatorFactory;
        this.logger = logger.child({ name: GenericDeviceUpdater.name });
    }

    public async update(device: AnyDevice, rawData: DeviceData): Promise<void> {
        let hadFailure = false;
        const schema = device.getAttributesSchema();

        for (const attrKey of getTypedKeys(rawData)) {
            const propertySchema = schema.properties[attrKey];

            if (!propertySchema) {
                this.logger.warn(`device: ${device.getDeviceId} -> has no attribute named: ${attrKey}`);
                continue;
            }

            if (propertySchema.readOnly === true) {
                this.logger.warn(`device: ${device.getDeviceId} -> attribute '${attrKey}' is read-only`);
                continue;
            }

            const value: unknown = rawData[attrKey];
            const deviceLogMsg = `device: ${device.getDeviceId} -> ${attrKey} ${JSON.stringify(value)}`;

            const validator = this.validatorFactory.create(propertySchema);

            if (!validator.validate(value)) {
                this.logger.warn(`${deviceLogMsg} -> validation failed: ${validator.getValidationErrorsAsText()}`);
                continue;
            }

            try {
                await device.setAttribute(attrKey, value);
                this.logger.info(`${deviceLogMsg} -> done`);
            } catch (e: unknown) {
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
