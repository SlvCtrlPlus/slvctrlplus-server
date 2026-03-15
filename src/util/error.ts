import BaseError from 'modern-errors';
import Logger from '../logging/Logger.js';

export const logError = (logger: Logger, message: string, error: unknown): void => {
    const baseError = BaseError.normalize(error);
    logger.error(`${message}: ${baseError.message}`, error);
};
