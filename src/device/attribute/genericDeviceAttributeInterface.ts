

export type AttributeValue = string | number | boolean;

export default interface GenericDeviceAttributeInterface<T extends AttributeValue = AttributeValue> {
     type: string; // This field is only here to expose it explicitly
     name: string;
     label?: string;
     value:  T;
     fromString(value: string): T;
}
