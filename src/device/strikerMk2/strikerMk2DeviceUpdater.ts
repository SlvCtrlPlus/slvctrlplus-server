import AbstractDeviceUpdater from "../abstractDeviceUpdater.js";
import PlainToClassSerializer from "../../serialization/plainToClassSerializer.js";
import StrikerMk2DeviceData from "./strikerMk2DeviceData.js";
import StrikerMk2Device from "./strikerMk2Device.js";
import Device from "../device.js";
import {DeviceData} from "../types";

export default class StrikerMk2DeviceUpdater extends AbstractDeviceUpdater
{
    public constructor(serializer: PlainToClassSerializer) {
        super(serializer);
    }

    public update(device: Device, rawData: DeviceData): void {
        const data = this.serializer.transform(StrikerMk2DeviceData, rawData);

        console.log(`device: ${device.getDeviceId} -> set speed: ${data.getSpeed} (requested)`);

        void (device as StrikerMk2Device).setSpeed(data.getSpeed)
            .then(() => console.log(`device: ${device.getDeviceId} -> set speed: ${data.getSpeed} (done)`));
    }
}
