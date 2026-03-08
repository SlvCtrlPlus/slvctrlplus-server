import DeviceProvider from './deviceProvider.js';
import { JsonObject } from '../../types.js';
import Device from '../device.js';

export default interface DeviceProviderFactory<DP extends DeviceProvider<any> = DeviceProvider<any>>
{
    create(config: JsonObject): DeviceProvider<DP extends DeviceProvider<infer D> ? D : Device>;
}
