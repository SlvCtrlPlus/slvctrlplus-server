import {Exclude, Expose} from "class-transformer";

@Exclude()
export default class AirValveDeviceData
{
    @Expose()
    private readonly flow: number;

    @Expose()
    private readonly duration: number;

    public constructor() {
        this.flow = 0;
        this.duration = 0;
    }

    public get getFlow(): number {
        return this.flow;
    }


    public get getDuration(): number {
        return this.duration;
    }
}
