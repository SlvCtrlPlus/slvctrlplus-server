import { AnyDeviceProvider } from './deviceProvider.js';
import { JsonObject } from '../../types.js';

export default interface DeviceProviderFactory<DP extends AnyDeviceProvider>
{
    create(config: JsonObject): DP;
}
