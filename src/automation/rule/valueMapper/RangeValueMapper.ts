import ValueMapperInterface from "./ValueMapperInterface.js";
import NumberDeviceOutput from "../../../device/numberDeviceOutput.js";
import NumberDeviceInput from "../../../device/numberDeviceInput.js";

export default class RangeValueMapper implements ValueMapperInterface<number, number>
{
    private readonly fromLowerBound: number;
    private readonly fromUpperBound: number;
    private readonly toLowerBound: number;
    private readonly toUpperBound: number;
    private readonly inverted: boolean;

    public constructor(
        fromLowerBound: number,
        fromUpperBound: number,
        toLowerBound: number,
        toUpperBound: number,
        inverted: boolean
    ) {
        this.fromLowerBound = fromLowerBound;
        this.fromUpperBound = fromUpperBound;
        this.toLowerBound = toLowerBound;
        this.toUpperBound = toUpperBound;
        this.inverted = inverted;
    }

    public static fromDeviceIOs(
        from: NumberDeviceOutput<any>,
        to: NumberDeviceInput<any>,
        inverted: boolean
    ): RangeValueMapper {
        return new this(
            from.getLowerBound,
            from.getUpperBound,
            to.getLowerBound,
            to.getUpperBound,
            inverted
        );
    }

    public map(inputValue: number): number {
        let mappedValue = RangeValueMapper.map(
            inputValue,
            this.fromLowerBound,
            this.fromUpperBound,
            this.toLowerBound,
            this.toUpperBound,
        );

        if (this.inverted) {
            mappedValue = this.toUpperBound - mappedValue;
        }

        return mappedValue;
    }

    private static map(x: number, inMin: number, inMax: number, outMin: number,  outMax: number): number {
        return Math.round((x - inMin) * (outMax - outMin) / (inMax - inMin) + outMin);
    }
}
