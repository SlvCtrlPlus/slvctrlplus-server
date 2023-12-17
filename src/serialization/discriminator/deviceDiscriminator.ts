import GenericSlvCtrlPlusDevice from "../../device/generic/genericSlvCtrlPlusDevice.js";
import ObjectDiscriminator from "./objectDiscriminator.js";

export default class DeviceDiscriminator extends ObjectDiscriminator {
    protected static discriminatorMap = [
        { value: GenericSlvCtrlPlusDevice, name: 'generic' },
    ];
}
