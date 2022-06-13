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
        // Queue update for later to not reject if device is busy
        const data = this.serializer.transform(Et312DeviceData, request.body);

        if (data.getMode !== undefined) {
            (device as Et312Device).setMode(data.getMode)
                .then(() => console.log(`device: ${device.getDeviceId} -> set mode: ${data.getMode} (done)`));;
        }

        if (data.getLevelA !== undefined) {
            (device as Et312Device).setLevel('A', data.getLevelA)
                .then(() => console.log(`device: ${device.getDeviceId} -> set level A: ${data.getLevelA} (done)`));;
        }

        if (data.getLevelB !== undefined) {
            (device as Et312Device).setLevel('B', data.getLevelB)
                .then(() => console.log(`device: ${device.getDeviceId} -> set level B: ${data.getLevelB} (done)`));;
        }

        if (data.getAdc !== undefined) {
            (device as Et312Device).setAdc(data.getAdc)
                .then(() => console.log(`device: ${device.getDeviceId} -> set adc: ${data.getAdc} (done)`));;
        }
    }
}
