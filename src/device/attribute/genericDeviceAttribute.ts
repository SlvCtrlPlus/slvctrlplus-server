import {Exclude, Expose} from "class-transformer";

export type AttributeValue = string | number | boolean;

export enum GenericDeviceAttributeModifier {
    readOnly = "ro",
    readWrite = "rw",
    writeOnly = "wo"
}

@Exclude()
export default abstract class GenericDeviceAttribute<T extends AttributeValue = AttributeValue> {
    @Expose()
    public type: string; // This field is only here to expose it explicitly

    @Expose()
    public name: string;

    @Expose()
    public label?: string;

    @Expose()
    public modifier: GenericDeviceAttributeModifier;

    @Expose()
    public value:  T;

    public abstract fromString(value: string): T;
}
