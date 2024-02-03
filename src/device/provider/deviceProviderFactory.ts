import DeviceProvider from "./deviceProvider.js";

export default interface DeviceProviderFactory
{
    create(config: JsonObject): DeviceProvider;
}
