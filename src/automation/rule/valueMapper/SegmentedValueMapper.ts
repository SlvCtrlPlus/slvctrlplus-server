import ValueMapperInterface from "./ValueMapperInterface.js";

type Segmentation<I, O> = {
    start: I,
    end: I,
    segment: O
}

export default class SegmentedValueMapper<I, O> implements ValueMapperInterface<I, O>
{
    private readonly segmentations: Segmentation<I, O>[] = [];

    public constructor(segmentations: Segmentation<I, O>[]) {
        this.segmentations = segmentations;
    }

    public map(inputValue: I): O {
        let mappedValue: O = null;

        for (const s of this.segmentations) {
            if (inputValue >= s.start && inputValue <= s.end) {
                mappedValue = s.segment;
                break;
            }
        }

        if (null === mappedValue) {
            throw new Error(`Could not map input value '${inputValue}' to segment`)
        }

        return mappedValue;
    }
}
