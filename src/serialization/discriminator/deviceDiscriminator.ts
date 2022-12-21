import AirValveDevice from "../../device/airValve/airValveDevice.js";
import GenericDevice from "../../device/genericDevice.js";
import Et312Device from "../../device/et312/et312Device.js";
import StrikerMk2Device from "../../device/strikerMk2/strikerMk2Device.js";
import DistanceDevice from "../../device/distance/distanceDevice.js";
import ObjectDiscriminator from "./objectDiscriminator.js";

export default class DeviceDiscriminator extends ObjectDiscriminator{
    protected static discriminatorMap = [
        { value: AirValveDevice, name: 'airValve' },
        { value: Et312Device, name: 'et312' },
        { value: StrikerMk2Device, name: 'strikerMk2' },
        { value: DistanceDevice, name: 'distance' },
        { value: GenericDevice, name: 'generic' },
    ];
}
