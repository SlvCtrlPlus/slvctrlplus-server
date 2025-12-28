import {Expose} from "class-transformer";
import {IntAttributeValue} from "./intDeviceAttribute.js";
import {Int} from "../../util/numbers.js";
import {DeviceAttributeModifier} from "./deviceAttribute.js";
import NumberDeviceAttribute from "./numberDeviceAttribute.js";

export type InitializedIntRangeDeviceAttribute = IntRangeDeviceAttribute<Int>;

export default class IntRangeDeviceAttribute<T extends IntAttributeValue = IntAttributeValue> extends NumberDeviceAttribute<T> {
    @Expose({ name: "min" })
    private _min: Int;

    @Expose({ name: "max" })
    private _max: Int;

    @Expose()
    private readonly _incrementStep: Int = Int.from(1);

    public constructor(name: string, label: string | undefined, modifier: DeviceAttributeModifier, uom: string | undefined, min: Int, max: Int, incrementStep: Int, initialValue: T) {
        super(name, label, modifier, uom, initialValue);
        this._min = min;
        this._max = max;
        this._incrementStep = incrementStep;
    }

    public static createInitialized(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        uom: string | undefined,
        min: Int,
        max: Int,
        incrementStep: Int,
        initialValue: Int
    ): InitializedIntRangeDeviceAttribute {
        return new IntRangeDeviceAttribute<Int>(name, label, modifier, uom, min, max, incrementStep, initialValue);
    }

    public static create(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        uom: string | undefined,
        min: Int,
        max: Int,
        incrementStep: Int
    ): IntRangeDeviceAttribute {
        return new IntRangeDeviceAttribute(name, label, modifier, uom, min, max, incrementStep, undefined);
    }

    public get min(): Int {
        return this._min;
    }

    public set min(value: Int) {
        this._min = value;
    }


    public get max(): Int {
        return this._max;
    }

    public set max(value: Int) {
        this._max = value;
    }

    public get incrementStep(): Int {
        return this._incrementStep;
    }

    public fromString(value: string): T {
        const res = parseInt(value, 10);

        if (isNaN(res)) {
            throw new Error(`Could not convert '${value}' to a valid value for ${this.constructor.name}`);
        }

        return res as T;
    }

    public getType(): string {
        return 'range';
    }
}
