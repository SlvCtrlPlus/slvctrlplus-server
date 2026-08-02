import { JsonObject } from '../types.js';

export interface SerializedKnownDevice {
    id: string;
    serialNo: string;
    name: string;
    type: string;
    source: string;
    config: JsonObject;
    enabled: boolean;
}

export interface SerializedDeviceSource {
    id: string;
    type: string;
    config: JsonObject;
    enabled: boolean;
}

export interface SerializedSettings {
    knownDevices: Record<string, SerializedKnownDevice>;
    deviceSources: Record<string, SerializedDeviceSource>;
}
