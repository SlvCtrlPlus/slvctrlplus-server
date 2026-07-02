import { Ajv } from 'ajv';
import fs from 'fs';
import JsonSchemaValidator from './JsonSchemaValidator.js';
import { TSchema } from '@sinclair/typebox';

export default class JsonSchemaValidatorFactory
{

    private readonly ajv: Ajv;

    public constructor(ajv: Ajv) {
        this.ajv = ajv;
    }

    public create<T extends TSchema>(schema: T): JsonSchemaValidator<T> {
        return new JsonSchemaValidator<T>(this.ajv, schema);
    }

    public createFromFile<T extends TSchema>(schemaFilePath: string): JsonSchemaValidator<T> {
        const schemaData: T = JSON.parse(fs.readFileSync(schemaFilePath, 'utf-8'));
        return new JsonSchemaValidator(this.ajv, schemaData);
    }
}
