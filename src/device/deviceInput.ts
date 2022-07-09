
export default interface DeviceInput<D,V>
{
    setValue(device: D, value: V): Promise<void>;
}
