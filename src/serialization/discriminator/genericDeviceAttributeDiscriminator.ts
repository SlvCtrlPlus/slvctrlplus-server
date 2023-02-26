import ObjectDiscriminator from "./objectDiscriminator.js";
import BoolGenericDeviceAttribute from "../../device/generic/boolGenericDeviceAttribute.js";
import IntGenericDeviceAttribute from "../../device/generic/intGenericDeviceAttribute.js";
import FloatGenericDeviceAttribute from "../../device/generic/floatGenericDeviceAttribute.js";
import StrGenericDeviceAttribute from "../../device/generic/strGenericDeviceAttribute.js";
import RangeGenericDeviceAttribute from "../../device/generic/rangeGenericDeviceAttribute.js";
import ListGenericDeviceAttribute from "../../device/generic/listGenericDeviceAttribute.js";

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
