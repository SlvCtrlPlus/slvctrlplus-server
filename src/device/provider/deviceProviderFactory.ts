import type { AnyDeviceProvider } from './deviceProvider.js';
import type { JsonObject } from '../../types.js';

type DeviceProviderFactory<DP extends AnyDeviceProvider> = {
    // TODO Switch to TypeBox schema for each ServiceProvider and adjust factory
    // Method syntax: some implementers (e.g. ButtplugIoWebsocketDeviceProviderFactory)
    // narrow config to a concrete shape; property syntax would check contravariantly
    // and reject that narrowing.
    // eslint-disable-next-line @typescript-eslint/method-signature-style
    create(config: JsonObject): DP;
};

export default DeviceProviderFactory;
