import {Exclude, Expose} from "class-transformer";

@Exclude()
export default class ValueMapping
{
    @Expose()
    private readonly lowerFrom: number;

    @Expose()
    private readonly upperFrom: number;

    @Expose()
    private readonly lowerTo: number;

    @Expose()
    private readonly upperTo: number;

    constructor(lowerFrom: number, upperFrom: number, lowerTo: number, upperTo: number) {
        this.lowerFrom = lowerFrom;
        this.upperFrom = upperFrom;
        this.lowerTo = lowerTo;
        this.upperTo = upperTo;
    }

    public mapValue(value: number): number {
        return this.map(value, this.lowerFrom, this.upperFrom, this.lowerTo, this.upperTo);
    }

    private map(x: number, inMin: number, inMax: number, outMin: number,  outMax: number): number {
        return (x - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    }
}
