import AbstractDeviceUpdater from "../abstractDeviceUpdater.js";
import PlainToClassSerializer from "../../serialization/plainToClassSerializer.js";
import AirValveDeviceData from "./airValveDeviceData.js";
import AirValveDevice from "./airValveDevice.js";
import Device from "../device.js";
import {Request} from "express";

export default class AirValveDeviceUpdater extends AbstractDeviceUpdater
{
    public constructor(serializer: PlainToClassSerializer) {
        super(serializer);
    }

    public update(device: Device, request: Request): void {
        const data = this.serializer.transform(AirValveDeviceData, request.body);

        console.log(`device: ${device.getDeviceId} -> set flow: ${data.getFlow}/${data.getDuration} (requested)`);

        (device as AirValveDevice).setFlow(data.getFlow, data.getDuration)
            .then(() => console.log(`device: ${device.getDeviceId} -> set flow: ${data.getFlow}/${data.getDuration} (done)`));
    }
}
