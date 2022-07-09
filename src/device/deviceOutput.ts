
export default interface DeviceOutput<D, V>
{
    getValue(device: D): V;
}
