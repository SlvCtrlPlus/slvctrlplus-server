import { ClassConstructor, TypeOptions } from 'class-transformer';

type DiscriminatorMap = {
    // Name of the type.
    name: string;
    // A class constructor which can be used to create the object.
    value: ClassConstructor<unknown>;
}[];

export default class ObjectDiscriminator {
    private readonly discriminatorMap: DiscriminatorMap;

    public constructor(discriminatorMap: DiscriminatorMap) {
        this.discriminatorMap = discriminatorMap;
    }

    public fromName(name: string): ClassConstructor<unknown> {
        for (const subType of this.discriminatorMap) {
            if (subType.name === name) {
                return subType.value;
            }
        }

        throw new Error(`Could not resolve from name '${name}'`);
    }

    public fromValue(value: ClassConstructor<unknown>): string {
        for (const subType of this.discriminatorMap) {
            if (subType.value === value) {
                return subType.name;
            }
        }

        throw new Error(`Could not resolve from value '${value.name}'`);
    }

    public createClassTransformerTypeDiscriminator(typePropertyName: string): TypeOptions {
        return {
            discriminator: {
                property: typePropertyName,
                subTypes: this.discriminatorMap,
            },
        };
    }
}
