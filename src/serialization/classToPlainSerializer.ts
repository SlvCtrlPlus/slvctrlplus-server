import { instanceToPlain, ClassTransformOptions, TypeOptions } from 'class-transformer';

export default class ClassToPlainSerializer
{
    private readonly options?: ClassTransformOptions;

    public constructor(options?: ClassTransformOptions)
    {
        this.options = options;
    }

    public transform<TOut extends Record<string, unknown>>(object: object, typeOptions?: TypeOptions | null): TOut;
    public transform(object: object, typeOptions: TypeOptions | null = null): Record<string, unknown>
    {
        const result = instanceToPlain(object, this.options);

        if (typeOptions !== null && typeOptions.discriminator !== undefined) {
            const discriminatorValue = typeOptions.discriminator.subTypes.find(obj => obj.value === object.constructor);

            if (undefined === discriminatorValue) {
                throw new Error('Could not find discriminator value for class of type: ' + object.constructor.name);
            }

            result[typeOptions.discriminator.property] = discriminatorValue.name;
        }

        return result;
    }
}
