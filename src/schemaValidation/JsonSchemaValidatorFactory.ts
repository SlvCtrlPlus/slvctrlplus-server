import { Ajv } from 'ajv';
import fs from "fs";
import JsonSchemaValidator from "./JsonSchemaValidator.js";
import {JsonObject} from "../types.js";
import type {Schema, JSONSchemaType} from "ajv";

export default class JsonSchemaValidatorFactory
{

    private readonly ajv: Ajv;

    public constructor(ajv: Ajv) {
        this.ajv = ajv;
    }

    public create<T = unknown>(schema: Schema | JSONSchemaType<T>): JsonSchemaValidator {
        return new JsonSchemaValidator(this.ajv, this.ajv.compile(schema));
    }

    public createFromFile(schemaFilePath: string): JsonSchemaValidator {
        const schemaData = JSON.parse(fs.readFileSync(schemaFilePath, 'utf-8')) as JsonObject;
        return new JsonSchemaValidator(this.ajv, this.ajv.compile(schemaData));
    }
}
