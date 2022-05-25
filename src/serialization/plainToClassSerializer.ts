import { ClassConstructor, ClassTransformOptions, plainToInstance } from 'class-transformer';

export default class PlainToClassSerializer
{
    private readonly options?: ClassTransformOptions;

    public constructor(options?: ClassTransformOptions)
    {
        this.options = options;
    }

    public transform<T, V>(cls: ClassConstructor<T>, plain: V): T
    {
        return plainToInstance(cls, plain, this.options);
    }
}
