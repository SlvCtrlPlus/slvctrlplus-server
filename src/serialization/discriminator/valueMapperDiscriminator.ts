import ObjectDiscriminator from "./objectDiscriminator.js";
import RangeValueMapper from "../../entity/automation/rule/valueMapper/RangeValueMapper.js";

export default class ValueMapperDiscriminator extends ObjectDiscriminator{
    protected static discriminatorMap = [
        { value: RangeValueMapper, name: 'range' },
    ];
}
