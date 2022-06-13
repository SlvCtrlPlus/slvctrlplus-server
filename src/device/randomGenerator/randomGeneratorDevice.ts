import {Exclude, Expose} from "class-transformer/types/index.js";
import RandomGeneratorDeviceData from "./randomGeneratorDeviceData.js";
import VirtualDevice from "../virtualDevice.js";

@Exclude()
export default class RandomGeneratorDevice extends VirtualDevice {

    @Expose()
    private data: RandomGeneratorDeviceData;

    public refreshData(): void {
        this.data = new RandomGeneratorDeviceData(Math.random());
    }
}
