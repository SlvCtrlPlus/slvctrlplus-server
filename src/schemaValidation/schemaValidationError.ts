import { ErrorObject } from 'ajv';

/**
 * Thrown by PlainToClassSerializer.transform() when a schema is passed and the plain value fails
 * validation against it. Callers that don't need the details can just let it propagate/log its
 * message; callers that do (e.g. to return a structured 400 response) can catch it and read
 * `validationErrors` directly, same shape as `Ajv.errors`.
 */
export default class SchemaValidationError extends Error
{
    public readonly validationErrors: ErrorObject[];

    public constructor(message: string, validationErrors: ErrorObject[]) {
        super(message);
        this.name = 'SchemaValidationError';
        this.validationErrors = validationErrors;
    }
}
