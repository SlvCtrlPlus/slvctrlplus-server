import GenericSlvCtrlPlusDevice from "../../device/protocol/slvCtrlPlus/genericSlvCtrlPlusDevice.js";
import ObjectDiscriminator from "./objectDiscriminator.js";

export default class DeviceDiscriminator extends ObjectDiscriminator {
    protected static discriminatorMap = [
        { value: GenericSlvCtrlPlusDevice, name: 'generic' },
    ];
}
