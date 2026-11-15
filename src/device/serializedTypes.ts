import type DeviceState from './deviceState.js';
import type { DeviceId } from './deviceId.js';
import type { JsonObject } from '../types.js';

type SerializedDeviceBase = {
    connectedSince: Date;
    deviceId: DeviceId;
    deviceName: string;
    provider: string;
    state: DeviceState;
    errorInfo: { reason: string, occurredAt: Date } | undefined;
    controllable: boolean;
    lastRefresh: Date | undefined;
    /** JSON Schema describing the device's attribute shape, validation rules, and metadata. */
    attributesSchema: JsonObject;
    /** Flat key→value map of current attribute state. */
    attributes: Record<string, unknown>;
    config: Record<string, unknown>;
};

type SerializedSlvCtrlPlusDevice = SerializedDeviceBase & {
    type: 'slvCtrlPlus';
    deviceModel: string;
    fwVersion: number;
    protocolVersion: number;
};

type SerializedButtplugIoDevice = SerializedDeviceBase & {
    type: 'buttplugIo';
    deviceModel: string;
};

type SerializedVirtualDevice = SerializedDeviceBase & {
    type: 'virtual';
    deviceModel: string;
    fwVersion: string;
};

type SerializedZc95Device = SerializedDeviceBase & {
    type: 'zc95';
    fwVersion: string;
};

type SerializedEStim2bDevice = SerializedDeviceBase & {
    type: 'estim2b';
    fwVersion: string;
};

export type SerializedDevice =
    | SerializedSlvCtrlPlusDevice
    | SerializedButtplugIoDevice
    | SerializedVirtualDevice
    | SerializedZc95Device
    | SerializedEStim2bDevice;
