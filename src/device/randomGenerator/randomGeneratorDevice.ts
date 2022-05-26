import {Exclude, Expose} from "class-transformer/types/index.js";
import Device from "../device.js";
import RandomGeneratorDeviceData from "./randomGeneratorDeviceData.js";

@Exclude()
export default class RandomGeneratorDevice extends Device {

    @Expose()
    private data: RandomGeneratorDeviceData;

    public refreshData(): void {
        this.data = new RandomGeneratorDeviceData(Math.random());
    }
}
