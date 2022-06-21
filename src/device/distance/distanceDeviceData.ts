import {Exclude, Expose} from "class-transformer";

@Exclude()
export default class DistanceDeviceData
{
    @Expose()
    private readonly sensor: string;

    @Expose()
    private readonly distance: number;

    @Expose()
    private readonly lux: number;

    public constructor(sensor: string, distance: number, lux: number) {
        this.sensor = sensor;
        this.distance = distance;
        this.lux = lux;
    }

    public get getDistance(): number {
        return this.distance;
    }

    public get getSensor(): string {
        return this.sensor;
    }

    public get getLux(): number {
        return this.lux;
    }
}
