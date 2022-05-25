import AbstractDeviceUpdater from "../abstractDeviceUpdater.js";
import PlainToClassSerializer from "../../serialization/plainToClassSerializer.js";
import Et312DeviceData from "./et312DeviceData.js";
import Et312Device from "./et312Device.js";
import Device from "../device.js";
import {Request} from "express";

export default class Et312DeviceUpdater extends AbstractDeviceUpdater
{
    public constructor(serializer: PlainToClassSerializer) {
        super(serializer);
    }

    public update(device: Device, request: Request): void {
        const data = this.serializer.transform(Et312DeviceData, request.body);

        /*console.log(`device: ${device.getDeviceId} -> set flow: ${data.getFlow}/${data.getDuration} (requested)`);

        (device as Et312Device).setFlow(data.getFlow, data.getDuration)
            .then(() => console.log(`device: ${device.getDeviceId} -> set flow: ${data.getFlow}/${data.getDuration} (done)`))
            .catch(console.log);*/
    }
}
