import type { AnyDeviceProvider } from './deviceProvider.js';
import type { JsonObject } from '../../types.js';

type DeviceProviderFactory<DP extends AnyDeviceProvider> = {
    create(config: JsonObject): DP;
};

export default DeviceProviderFactory;
