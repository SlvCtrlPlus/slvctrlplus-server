import BaseError from 'modern-errors';
import Logger from '../logging/Logger.js';

export const logError = (logger: Logger, message: string, error: unknown): void => {
    const baseError = error instanceof Error ? error : BaseError.normalize(error);
    logger.error(`${message}: ${baseError.message}`, baseError);
};
