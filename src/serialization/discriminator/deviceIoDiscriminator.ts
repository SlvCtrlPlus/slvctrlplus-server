import ObjectDiscriminator from "./objectDiscriminator.js";
import NumberDeviceOutput from "../../device/numberDeviceOutput.js";
import NumberDeviceInput from "../../device/numberDeviceInput.js";

export default class DeviceIoDiscriminator extends ObjectDiscriminator{
    protected static discriminatorMap = [
        { value: NumberDeviceOutput, name: 'number' },
        { value: NumberDeviceInput, name: 'number' },
    ];
}
