import {Exclude, Expose} from "class-transformer/types/index.js";
import RandomGeneratorDeviceData from "./randomGeneratorDeviceData.js";
import VirtualDevice from "../protocol/virtual/virtualDevice.js";

@Exclude()
export default class RandomGeneratorDevice extends VirtualDevice {

    @Expose()
    private data: RandomGeneratorDeviceData;

    public refreshData(): Promise<void> {
        return new Promise<void>((resolve) => {
            this.data = new RandomGeneratorDeviceData(Math.random());
            resolve();
        });
    }
}
