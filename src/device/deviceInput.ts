import {Expose} from "class-transformer";

export default abstract class DeviceInput<D,V>
{
    @Expose()
    private readonly unit: string|null;

    protected constructor(unit: string|null) {
        this.unit = unit;
    }

    public abstract setValue(device: D, value: V): Promise<void>;
}
