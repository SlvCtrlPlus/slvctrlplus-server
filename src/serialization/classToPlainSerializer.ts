import { instanceToPlain, ClassTransformOptions, TypeOptions } from 'class-transformer';

export default class ClassToPlainSerializer
{
    private readonly options?: ClassTransformOptions;

    public constructor(options?: ClassTransformOptions)
    {
        this.options = options;
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- TOut is caller-specified as a type witness for the result (e.g. serializer.transform<SerializedDevice>(...)), not inferred from another param
    public transform<TOut extends Record<string, unknown>>(object: object, typeOptions?: TypeOptions | null): TOut;
    public transform(object: object, typeOptions: TypeOptions | null = null): Record<string, unknown>
    {
        const result = instanceToPlain(object, this.options);

        if (typeOptions?.discriminator !== undefined) {
            const discriminatorValue = typeOptions.discriminator.subTypes.find(obj => obj.value === object.constructor);

            if (undefined === discriminatorValue) {
                throw new Error('Could not find discriminator value for class of type: ' + object.constructor.name);
            }

            result[typeOptions.discriminator.property] = discriminatorValue.name;
        }

        return result;
    }
}
