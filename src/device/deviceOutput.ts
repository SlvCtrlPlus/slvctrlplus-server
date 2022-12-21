import {Expose} from "class-transformer";

export default abstract class DeviceOutput<D, V>
{
    @Expose()
    private readonly unit: string|null;

    protected constructor(unit: string|null) {
        this.unit = unit;
    }

    public abstract getValue(device: D): V;
}
