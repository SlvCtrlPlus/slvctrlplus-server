import BaseError from 'modern-errors';
import Logger from '../logging/Logger.js';
import { IntervalTimeoutError } from './async.js';

export const logError = (logger: Logger, message: string, error: unknown): void => {
    if (error instanceof IntervalTimeoutError) {
        logger.warn(`${message}: ${error.message}`);
        return;
    }

    const baseError = error instanceof Error ? error : BaseError.normalize(error);
    logger.error(`${message}: ${baseError.message}`, baseError);
};
