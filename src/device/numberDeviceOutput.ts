import DeviceOutput from "./deviceOutput.js";
import {Exclude, Expose} from "class-transformer";

@Exclude()
export default class NumberDeviceOutput<D> extends DeviceOutput<D, number>
{
    @Expose()
    private readonly lowerBound: number;

    @Expose()
    private readonly upperBound: number;

    @Expose()
    protected readonly type: string; // This field is only here to expose it explicitly

    private readonly getter: (device: D) => number;

    constructor(getter: (device: D) => number, lowerBound: number, upperBound: number, unit: string|null = null) {
        super(unit);
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
