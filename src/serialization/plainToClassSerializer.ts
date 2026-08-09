import type { ClassConstructor, ClassTransformOptions } from 'class-transformer';
import { plainToInstance } from 'class-transformer';
import type { TSchema } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import type { Ajv } from 'ajv';
import SchemaValidationError from '../schemaValidation/schemaValidationError.js';

export default class PlainToClassSerializer
{
    private readonly ajv: Ajv;

    private readonly options?: ClassTransformOptions;

    public constructor(ajv: Ajv, options?: ClassTransformOptions)
    {
        this.ajv = ajv;
        this.options = options;
    }

    public transform<T>(cls: ClassConstructor<T>, plain: unknown, schema?: TSchema): T
    {
        if (undefined === schema) {
            return plainToInstance(cls, plain, this.options);
        }

        if (!this.ajv.validate(schema, plain)) {
            throw new SchemaValidationError(
                this.ajv.errorsText(this.ajv.errors),
                this.ajv.errors ?? [],
            );
        }

        return plainToInstance(cls, Value.Default(schema, Value.Clone(plain)), this.options);
    }
}
