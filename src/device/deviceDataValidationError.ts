import type { DeviceDataApplyError } from './device.js';

/**
 * Thrown when a merged attribute candidate fails schema validation before any
 * device messages are sent. Controllers should map this to a 400 response.
 */
export default class DeviceDataValidationError extends Error
{
    public readonly validationErrors: DeviceDataApplyError[];

    public constructor(message: string, validationErrors: DeviceDataApplyError[]) {
        super(message);
        this.name = 'DeviceDataValidationError';
        this.validationErrors = validationErrors;
    }
}
