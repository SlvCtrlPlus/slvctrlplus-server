import {Exclude, Expose} from "class-transformer";
import DeviceInput from "./deviceInput.js";

@Exclude()
export default class NumberDeviceInput<D> extends DeviceInput<D, number>
{
    @Expose()
    private readonly lowerBound: number;

    @Expose()
    private readonly upperBound: number;

    @Expose()
    protected readonly type: string; // This field is only here to expose it explicitly

    private readonly setter: (device: D, value: number) => Promise<void>;

    constructor(
        setter: (device: D, value: number) => Promise<void>,
        lowerBound: number,
        upperBound: number,
        unit: string|null = null,
    ) {
        super(unit);
        this.upperBound = upperBound;
        this.lowerBound = lowerBound;
        this.setter = setter;
    }

    public get getUpperBound(): number {
        return this.upperBound;
    }

    public get getLowerBound(): number {
        return this.lowerBound;
    }

    public async setValue(device: D, value: number): Promise<void> {
        return this.setter(device, value);
    }
}
