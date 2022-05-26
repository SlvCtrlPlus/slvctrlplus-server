import {Exclude, Expose} from "class-transformer";

@Exclude()
export default class RandomGeneratorDeviceData
{
    @Expose()
    private readonly value: number;

    public constructor(value: number) {
        this.value = value;
    }
}
