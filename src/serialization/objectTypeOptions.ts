import {TypeOptions} from "class-transformer";
import GenericDevice from "../device/generic/genericDevice.js";

export default class ObjectTypeOptions
{
    public static readonly device: TypeOptions = {
        discriminator: {
            property: 'type',
            subTypes: [
                { value: GenericDevice, name: 'generic' },
            ]
        },
    };
}
