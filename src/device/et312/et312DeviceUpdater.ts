import AbstractDeviceUpdater from "../abstractDeviceUpdater.js";
import PlainToClassSerializer from "../../serialization/plainToClassSerializer.js";
import Et312DeviceData from "./et312DeviceData.js";
import Device from "../device.js";
import Et312Device from "./et312Device.js";
import {DeviceData} from "../types";

export default class Et312DeviceUpdater extends AbstractDeviceUpdater
{
    public constructor(serializer: PlainToClassSerializer) {
        super(serializer);
    }

    public update(device: Device, rawData: DeviceData): void {
        // Queue update for later to not reject if device is busy
        const data = this.serializer.transform(Et312DeviceData, rawData);

        if (data.getMode !== undefined) {
            void (device as Et312Device).setMode(data.getMode)
                .then(() => console.log(`device: ${device.getDeviceId} -> set mode: ${data.getMode} (done)`));
        }

        if (data.getLevelA !== undefined) {
            void (device as Et312Device).setLevel('A', data.getLevelA)
                .then(() => console.log(`device: ${device.getDeviceId} -> set level A: ${data.getLevelA} (done)`));
        }

        if (data.getLevelB !== undefined) {
            void (device as Et312Device).setLevel('B', data.getLevelB)
                .then(() => console.log(`device: ${device.getDeviceId} -> set level B: ${data.getLevelB} (done)`));
        }

        if (data.getAdc !== undefined) {
            void (device as Et312Device).setAdc(data.getAdc)
                .then(() => console.log(`device: ${device.getDeviceId} -> set adc: ${data.getAdc} (done)`));
        }
    }
}
