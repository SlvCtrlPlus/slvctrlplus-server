import {TypeOptions} from "class-transformer";
import GenericSlvCtrlPlusDevice from "../device/generic/genericSlvCtrlPlusDevice.js";

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
