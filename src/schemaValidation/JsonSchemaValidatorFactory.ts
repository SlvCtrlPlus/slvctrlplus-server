import type { Ajv } from 'ajv';
import JsonSchemaValidator from './JsonSchemaValidator.js';
import type { TSchema } from '@sinclair/typebox';

export default class JsonSchemaValidatorFactory
{
    private readonly ajv: Ajv;

    public constructor(ajv: Ajv) {
        this.ajv = ajv;
    }

    public create<T extends TSchema>(schema: T): JsonSchemaValidator<T> {
        return new JsonSchemaValidator<T>(this.ajv, schema);
    }
}
