import ObjectDiscriminator from "./objectDiscriminator.js";
import BoolGenericDeviceAttribute from "../../device/attribute/boolGenericDeviceAttribute.js";
import IntGenericDeviceAttribute from "../../device/attribute/intGenericDeviceAttribute.js";
import FloatGenericDeviceAttribute from "../../device/attribute/floatGenericDeviceAttribute.js";
import StrGenericDeviceAttribute from "../../device/attribute/strGenericDeviceAttribute.js";
import RangeGenericDeviceAttribute from "../../device/attribute/rangeGenericDeviceAttribute.js";
import ListGenericDeviceAttribute from "../../device/attribute/listGenericDeviceAttribute.js";

export default class GenericDeviceAttributeDiscriminator extends ObjectDiscriminator {
    protected static discriminatorMap = [
        { value: BoolGenericDeviceAttribute, name: 'bool' },
        { value: IntGenericDeviceAttribute, name: 'int' },
        { value: FloatGenericDeviceAttribute, name: 'float' },
        { value: StrGenericDeviceAttribute, name: 'str' },
        { value: RangeGenericDeviceAttribute, name: 'range' },
        { value: ListGenericDeviceAttribute, name: 'list' }
    ];
}
