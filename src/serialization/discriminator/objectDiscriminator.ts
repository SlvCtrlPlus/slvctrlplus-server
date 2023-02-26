import {ClassConstructor, TypeOptions} from "class-transformer";

type DiscriminatorMap = {
    /**
     * Name of the type.
     */
    name: string;
    /**
     * A class constructor which can be used to create the object.
     */
    value: ClassConstructor<any>;
}[];

export default abstract class ObjectDiscriminator {
    protected static discriminatorMap: DiscriminatorMap;

    public static fromName(name: string): ClassConstructor<any> {
        for (const subType of this.discriminatorMap) {
            if (subType.name === name) {
                return subType.value;
            }
        }

        throw new Error(`Could not resolve from name '${name}'`);
    }

    public static fromValue(value: ClassConstructor<any>): string {
        for (const subType of this.discriminatorMap) {
            if (subType.value === value) {
                return subType.name;
            }
        }

        throw new Error(`Could not resolve from value '${value}'`);
    }

    public static createClassTransformerTypeDiscriminator(typePropertyName: string): TypeOptions {
        return {
            discriminator: {
                property: typePropertyName,
                subTypes: this.discriminatorMap
            },
        };
    }
}
