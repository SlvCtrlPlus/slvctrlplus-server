import GenericSlvCtrlPlusDevice from "../../device/protocol/slvCtrlPlus/genericSlvCtrlPlusDevice.js";
import ObjectDiscriminator from "./objectDiscriminator.js";
import ButtplugIoDevice from "../../device/protocol/buttplugIo/buttplugIoDevice.js";
import RandomGeneratorVirtualDevice
    from "../../device/protocol/virtual/randomGenerator/randomGeneratorVirtualDevice.js";
import DisplayVirtualDevice from "../../device/protocol/virtual/display/displayVirtualDevice.js";

export default class DeviceDiscriminator extends ObjectDiscriminator {
    protected static discriminatorMap = [
        { value: GenericSlvCtrlPlusDevice, name: 'slvCtrlPlus' },
        { value: ButtplugIoDevice, name: 'buttplugIo' },
        { value: RandomGeneratorVirtualDevice, name: 'virtualRandomGenerator' },
        { value: DisplayVirtualDevice, name: 'virtualDisplay' },
    ];
}
