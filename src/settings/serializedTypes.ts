import { JsonObject } from '../types.js';

export type SerializedKnownDevice = {
    id: string;
    serialNo: string;
    name: string;
    type: string;
    source: string;
    config: JsonObject;
    enabled: boolean;
}

export type SerializedDeviceSource = {
    id: string;
    type: string;
    config: JsonObject;
    enabled: boolean;
}

export type SerializedSettings = {
    knownDevices: Record<string, SerializedKnownDevice>;
    deviceSources: Record<string, SerializedDeviceSource>;
}
