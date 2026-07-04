import { Ajv, ErrorObject, ValidateFunction } from 'ajv';
import { Static, TSchema } from '@sinclair/typebox';

export default class JsonSchemaValidator<T extends TSchema>
{
    private readonly ajv: Ajv;

    private readonly schemaValidator: ValidateFunction;

    public constructor(ajv: Ajv, schema: T) {
        this.ajv = ajv;
        this.schemaValidator = ajv.compile(schema);
    }

    public validate(data: unknown): data is Static<T> {
        return this.schemaValidator(data);
    }

    public getValidationErrors(): ErrorObject[] {
        return this.schemaValidator.errors ?? [];
    }

    public getValidationErrorsAsText(): string {
        return this.ajv.errorsText(this.schemaValidator.errors);
    }
}
