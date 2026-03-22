import KnownDevice from '../settings/knownDevice.js';
import { ClassToPlainNormalizer, PlainToClassDenormalizer } from './classToPlainNormalizerInterface.js';
import { Type, Static, TSchema, TAnySchema } from '@sinclair/typebox';
import { Ajv, ValidateFunction } from 'ajv';

export const knownDeviceSchema = Type.Object({
    id: Type.String(),
    name: Type.String(),
    serialNo: Type.String(),
    type: Type.String(),
    source: Type.String(),
    config: Type.Record(Type.String(), Type.Any()),
}, {
    additionalProperties: false,
});

export type KnownDeviceSchema = typeof knownDeviceSchema;

export const knownDeviceNormalizer: ClassToPlainNormalizer<KnownDevice, KnownDeviceSchema> = (value: KnownDevice): Static<KnownDeviceSchema> => ({
    id: value.id.toString(),
    name: value.name,
    serialNo: value.serialNo,
    type: value.type,
    source: value.source,
    config: value.config,
});

export const knownDeviceDenormalizer: PlainToClassDenormalizer<KnownDevice, KnownDeviceSchema> = (value: unknown, schema: KnownDeviceSchema): KnownDevice => {
    assertSchema(value, schema);

    return new KnownDevice(
        value.id,
        value.serialNo,
        value.name,
        value.type,
        value.source,
        value.config,
    );
};

type AnyClass<T = any> = abstract new (...args: any[]) => T;

class Normalizer
{
    private ajv: Ajv;

    private normalizers = new Map<unknown, (value: AnyClass) => any>();
    private denormalizers = new Map<unknown, (value: unknown) => any>();

    public constructor(ajv: Ajv) {
        this.ajv = ajv;
    }

    public addNormalizer<TClass extends AnyClass, TSchema extends TAnySchema>(className: TClass, schema: TSchema, normalizer: (value: TClass, normalizer: Normalizer) => Static<TSchema>): Normalizer
    {
        this.normalizers.set(schema, (value: TClass) => normalizer(value, this));

        return this;
    }

    public addDenormalizer<TClass extends AnyClass, TSchema extends TAnySchema>(className: TClass, schema: TSchema, denormalizer: (value: Static<TSchema>, normalizer: Normalizer) => TClass): Normalizer
    {
        this.denormalizers.set(className, (value: unknown) => {
            assertSchema(value, schema);

            return denormalizer(value, this);
        });

        return this;
    }

    public normalize<TClass extends AnyClass, TSchema extends TAnySchema>(value: TClass, toSchema: TSchema): Static<TSchema>
    {
        const normalizer = this.normalizers.get(toSchema);

        if (undefined === normalizer) {
            throw new Error(`Could not find normalizer for this schema`);
        }

        return normalizer(value);
    }

    public denormalize<TClass extends AnyClass>(value: unknown, toClass: TClass): TClass
    {
        const denormalizer = this.denormalizers.get(toClass);

        if (undefined === denormalizer) {
            throw new Error(`Could not find denormalizer for this class`);
        }

        return denormalizer(value);
    }
}

const ajv = new Ajv();
const validatorCache = new Map<TSchema, ValidateFunction>();

const getValidator: <S extends TSchema>(schema: S) => ValidateFunction = (schema) => {
    if (!validatorCache.has(schema)) {
        validatorCache.set(schema, ajv.compile(schema));
    }
    return validatorCache.get(schema)!;
}

const assertSchema: <S extends TSchema>(value: unknown, schema: S) => asserts value is Static<S> = (value, schema) => {
    const validator = getValidator(schema);

    if (!validator(value)) {
        throw new Error(ajv.errorsText(validator.errors));
    }
};
