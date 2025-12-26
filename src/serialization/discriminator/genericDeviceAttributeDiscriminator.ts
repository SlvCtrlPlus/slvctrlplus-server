import ObjectDiscriminator from "./objectDiscriminator.js";
import BoolDeviceAttribute from "../../device/attribute/boolDeviceAttribute.js";
import IntDeviceAttribute from "../../device/attribute/intDeviceAttribute.js";
import FloatDeviceAttribute from "../../device/attribute/floatDeviceAttribute.js";
import StrDeviceAttribute from "../../device/attribute/strDeviceAttribute.js";
import IntRangeDeviceAttribute from "../../device/attribute/intRangeDeviceAttribute.js";
import ListDeviceAttribute from "../../device/attribute/listDeviceAttribute.js";

export default class GenericDeviceAttributeDiscriminator extends ObjectDiscriminator {
    protected static discriminatorMap = [
        { value: BoolDeviceAttribute, name: 'bool' },
        { value: IntDeviceAttribute, name: 'int' },
        { value: FloatDeviceAttribute, name: 'float' },
        { value: StrDeviceAttribute, name: 'str' },
        { value: IntRangeDeviceAttribute, name: 'range' },
        { value: ListDeviceAttribute, name: 'list' }
    ];
}
