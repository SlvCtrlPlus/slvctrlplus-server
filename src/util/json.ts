import { Static } from '@sinclair/typebox';
import JsonSchemaValidator from '../schemaValidation/JsonSchemaValidator.js';
import type { TSchema } from '@sinclair/typebox';
import SchemaValidationError from '../schemaValidation/schemaValidationError.js';
import { normalizeError } from './typeUtils.js';

export const parseAndValidateJson = <T extends TSchema>(data: string, jsonSchemaValidator: JsonSchemaValidator<T>): Static<T> => {
    let json: unknown;

    try {
        json = JSON.parse(data);
    } catch (e: unknown) {
        throw new Error(`Could not parse JSON: ${normalizeError(e).message}`, { cause: e });
    }

    if (!jsonSchemaValidator.validate(json)) {
        const validationError = new SchemaValidationError(
            jsonSchemaValidator.getValidationErrorsAsText(),
            jsonSchemaValidator.getValidationErrors(),
        );
        throw new Error(`Invalid JSON shape: ${normalizeError(validationError).message}`, { cause: validationError });
    }

    return json;
};
