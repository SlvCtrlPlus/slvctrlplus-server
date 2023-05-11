import GenericDevice from "../../device/generic/genericDevice.js";
import ButtplugIoDevice from "../../device/buttplugIoDevice.js";
import ObjectDiscriminator from "./objectDiscriminator.js";

export default class DeviceDiscriminator extends ObjectDiscriminator {
    protected static discriminatorMap = [
        { value: GenericDevice, name: 'generic' },
        { value: ButtplugIoDevice, name: 'buttplugio' }
    ];
}
