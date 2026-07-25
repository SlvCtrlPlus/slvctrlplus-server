import { ErrorObject } from 'ajv';

export default class SchemaValidationError extends Error
{
    public readonly validationErrors: ErrorObject[];

    public constructor(message: string, validationErrors: ErrorObject[]) {
        super(message);
        this.name = 'SchemaValidationError';
        this.validationErrors = validationErrors;
    }
}
