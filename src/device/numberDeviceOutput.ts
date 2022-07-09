import DeviceOutput from "./deviceOutput.js";
import {Exclude, Expose} from "class-transformer";

@Exclude()
export default class NumberDeviceOutput<D> implements DeviceOutput<D, number>
{

    @Expose()
    private readonly upperBound: number;

    @Expose()
    private readonly lowerBound: number;

    @Expose()
    protected readonly type: string; // This field is only here to expose it explicitly

    private readonly getter: (device: D) => number;

    constructor(getter: (device: D) => number, upperBound: number, lowerBound: number) {
        this.upperBound = upperBound;
        this.lowerBound = lowerBound;
        this.getter = getter;
    }

    public get getUpperBound(): number {
        return this.upperBound;
    }

    public get getLowerBound(): number {
        return this.lowerBound;
    }

    public getValue(device: D): number {
        return this.getter(device);
    }
}
