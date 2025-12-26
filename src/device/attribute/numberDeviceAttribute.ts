import DeviceAttribute, {DeviceAttributeModifier, NotJustUndefined, NotUndefined} from "./deviceAttribute.js";
import {Expose} from "class-transformer";
import {Float, Int} from "../../util/numbers.js";

export type NumberAttributeValue = NotJustUndefined<Int | Float | undefined>;

export default abstract class NumberDeviceAttribute<T extends NumberAttributeValue = NumberAttributeValue> extends DeviceAttribute<T> {

    @Expose({ name: "uom" })
    private readonly _uom: string|undefined;

    public constructor(
        name: string,
        label: string | undefined,
        modifier: DeviceAttributeModifier,
        uom: string | undefined,
        initialValue: T
    ) {
        super(name, label, modifier, initialValue);
        this._uom = uom;
    }

    public get uom() {
        return this._uom;
    }

    public isValidValue(value: unknown): value is NotUndefined<T> {
        return typeof value === 'number';
    }
}
