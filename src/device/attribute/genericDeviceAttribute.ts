import {Exclude, Expose} from "class-transformer";

export enum GenericDeviceAttributeModifier {
    readOnly = "ro",
    readWrite = "rw",
    writeOnly = "wo"
}

@Exclude()
export default abstract class GenericDeviceAttribute {
    @Expose()
    public type: string; // This field is only here to expose it explicitly

    @Expose()
    public name: string;

    @Expose()
    public modifier: GenericDeviceAttributeModifier;

    public fromString(value: string): string|number|boolean
    {
        return value;
    }
}
