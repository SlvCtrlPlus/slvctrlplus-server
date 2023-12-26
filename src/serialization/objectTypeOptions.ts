import {TypeOptions} from "class-transformer";
import GenericSlvCtrlPlusDevice from "../device/protocol/slvCtrlPlus/genericSlvCtrlPlusDevice.js";

export default class ObjectTypeOptions
{
    public static readonly device: TypeOptions = {
        discriminator: {
            property: 'type',
            subTypes: [
                { value: GenericSlvCtrlPlusDevice, name: 'generic' },
            ]
        },
    };
}
