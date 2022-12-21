import {Exclude, Expose} from "class-transformer";
import AbstractValueMapper from "./AbstractValueMapper.js";

@Exclude()
export default class RangeValueMapper extends AbstractValueMapper
{
    @Expose()
    private readonly fromLowerBound: number;
    @Expose()
    private readonly fromUpperBound: number;
    @Expose()
    private readonly toLowerBound: number;
    @Expose()
    private readonly toUpperBound: number;
    @Expose()
    private readonly inverted: boolean;

    constructor(
        fromLowerBound: number,
        fromUpperBound: number,
        toLowerBound: number,
        toUpperBound: number,
        inverted: boolean
    ) {
        super();
        this.fromLowerBound = fromLowerBound;
        this.fromUpperBound = fromUpperBound;
        this.toLowerBound = toLowerBound;
        this.toUpperBound = toUpperBound;
        this.inverted = inverted;
    }

    public get getFromLowerBound(): number {
        return this.fromLowerBound;
    }

    public get getFromUpperBound(): number {
        return this.fromUpperBound;
    }

    public get getToLowerBound(): number {
        return this.toLowerBound;
    }

    public get getToUpperBound(): number {
        return this.toUpperBound;
    }

    public get isInverted(): boolean {
        return this.inverted;
    }
}
