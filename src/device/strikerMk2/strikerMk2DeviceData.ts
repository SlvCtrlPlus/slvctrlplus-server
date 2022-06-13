import {Exclude, Expose} from "class-transformer";

@Exclude()
export default class StrikerMk2DeviceData
{
    @Expose()
    private readonly speed: number;

    public constructor(speed: number) {
        this.speed = speed;
    }

    public get getSpeed(): number {
        return this.speed;
    }
}
