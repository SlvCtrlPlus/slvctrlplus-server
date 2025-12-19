import GenericSlvCtrlPlusDevice from "../../device/protocol/slvCtrlPlus/genericSlvCtrlPlusDevice.js";
import ObjectDiscriminator from "./objectDiscriminator.js";
import ButtplugIoDevice from "../../device/protocol/buttplugIo/buttplugIoDevice.js";
import VirtualDevice from "../../device/protocol/virtual/virtualDevice.js";
import Zc95Device from "../../device/protocol/zc95/zc95Device.js";

export default class DeviceDiscriminator extends ObjectDiscriminator {
    protected static discriminatorMap = [
        { value: GenericSlvCtrlPlusDevice, name: 'slvCtrlPlus' },
        { value: ButtplugIoDevice, name: 'buttplugIo' },
        { value: Zc95Device, name: 'zc95' },
        { value: VirtualDevice, name: 'virtual' },
    ];
}
