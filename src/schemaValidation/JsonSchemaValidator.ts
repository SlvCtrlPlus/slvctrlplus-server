import Ajv, {ErrorObject} from "ajv/dist/2020.js";
import {ValidateFunction} from "ajv/dist/2020.js";
import {JsonObject} from "../types.js";

export default class JsonSchemaValidator
{
    private readonly ajv: Ajv;

    private readonly schemaValidator: ValidateFunction;

    public constructor(ajv: Ajv, schemaValidator: ValidateFunction) {
        this.ajv = ajv;
        this.schemaValidator = schemaValidator;
    }

    public validate(data: JsonObject): boolean {
        return this.schemaValidator(data);
    }

    public getValidationErrors(): ErrorObject[] {
        return this.schemaValidator.errors ?? [];
    }

    public getValidationErrorsAsText(): string {
        return this.ajv.errorsText(this.schemaValidator.errors);
    }
}
