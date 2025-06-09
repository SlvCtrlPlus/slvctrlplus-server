import GenericSlvCtrlPlusDevice from "../../device/protocol/slvCtrlPlus/genericSlvCtrlPlusDevice.js";
import ObjectDiscriminator from "./objectDiscriminator.js";
import ButtplugIoDevice from "../../device/protocol/buttplugIo/buttplugIoDevice.js";
import VirtualDevice from "../../device/protocol/virtual/virtualDevice.js";

export default class DeviceDiscriminator extends ObjectDiscriminator {
    protected static discriminatorMap = [
        { value: GenericSlvCtrlPlusDevice, name: 'slvCtrlPlus' },
        { value: ButtplugIoDevice, name: 'buttplugIo' },
        { value: VirtualDevice, name: 'virtual' },
    ];
}
