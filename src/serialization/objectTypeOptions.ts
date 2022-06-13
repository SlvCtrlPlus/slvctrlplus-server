import {TypeOptions} from "class-transformer";
import AirValveDevice from "../device/airValve/airValveDevice.js";
import GenericDevice from "../device/genericDevice.js";
import Et312Device from "../device/et312/et312Device.js";
import StrikerMk2Device from "../device/strikerMk2/strikerMk2Device.js";

export default class ObjectTypeOptions
{
    public static readonly device: TypeOptions = {
        discriminator: {
            property: 'type',
            subTypes: [
                { value: AirValveDevice, name: 'airValve' },
                { value: Et312Device, name: 'et312' },
                { value: StrikerMk2Device, name: 'strikerMk2' },
                { value: GenericDevice, name: 'generic' },
            ]
        },
    };
}
