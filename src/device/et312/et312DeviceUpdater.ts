import AbstractDeviceUpdater from "../abstractDeviceUpdater.js";
import PlainToClassSerializer from "../../serialization/plainToClassSerializer.js";
import Et312DeviceData from "./et312DeviceData.js";
import Device from "../device.js";
import {Request} from "express";
import Et312Device from "./et312Device.js";

export default class Et312DeviceUpdater extends AbstractDeviceUpdater
{
    public constructor(serializer: PlainToClassSerializer) {
        super(serializer);
    }

    public update(device: Device, request: Request): void {
        const data = this.serializer.transform(Et312DeviceData, request.body);

        if (data.getMode !== undefined) {
            (device as Et312Device).setMode(data.getMode).catch(console.log);
        }

        if (data.getLevelA !== undefined) {
            (device as Et312Device).setLevel('A', data.getLevelA).catch(console.log);
        }

        if (data.getLevelB !== undefined) {
            (device as Et312Device).setLevel('B', data.getLevelB).catch(console.log);
        }

        if (data.getAdc !== undefined) {
            (device as Et312Device).setAdc(data.getAdc).catch(console.log);
        }
    }
}
