import DeviceProvider from "./deviceProvider.js";
import {JsonObject} from "../../types.js";

export default interface DeviceProviderFactory
{
    create(config: JsonObject): DeviceProvider;
}
