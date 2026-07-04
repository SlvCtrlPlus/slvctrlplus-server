import DeviceProvider from './deviceProvider.js';
import { JsonObject } from '../../types.js';

export default interface DeviceProviderFactory<DP extends DeviceProvider>
{
    create(config: JsonObject): DP;
}
