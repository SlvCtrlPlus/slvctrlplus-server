import DeviceState from './deviceState.js';
import { DeviceAttributeModifier } from './attribute/deviceAttribute.js';

type SerializedDeviceAttributeBase = {
    name: string;
    label: string | undefined;
    modifier: DeviceAttributeModifier;
    type: string;
}

export type SerializedIntRangeDeviceAttribute = SerializedDeviceAttributeBase & {
    type: 'range';
    value: number | undefined;
    min: number;
    max: number;
    incrementStep: number;
    uom: string | undefined;
}

export type SerializedIntDeviceAttribute = SerializedDeviceAttributeBase & {
    type: 'int';
    value: number | undefined;
    uom: string | undefined;
}

export type SerializedFloatDeviceAttribute = SerializedDeviceAttributeBase & {
    type: 'float';
    value: number | undefined;
    uom: string | undefined;
}

export type SerializedBoolDeviceAttribute = SerializedDeviceAttributeBase & {
    type: 'bool';
    value: boolean | undefined;
}

export type SerializedStrDeviceAttribute = SerializedDeviceAttributeBase & {
    type: 'str';
    value: string | undefined;
}

export type SerializedListDeviceAttribute = SerializedDeviceAttributeBase & {
    type: 'list';
    value: string | number | undefined;
    values: { key: string | number; value: string | number }[];
}

export type SerializedDeviceAttribute =
    | SerializedIntRangeDeviceAttribute
    | SerializedIntDeviceAttribute
    | SerializedFloatDeviceAttribute
    | SerializedBoolDeviceAttribute
    | SerializedStrDeviceAttribute
    | SerializedListDeviceAttribute;

type SerializedDeviceBase = {
    connectedSince: Date;
    deviceId: string;
    deviceName: string;
    provider: string;
    state: DeviceState;
    errorInfo: { reason: string; occurredAt: Date } | undefined;
    controllable: boolean;
    lastRefresh: Date | undefined;
    attributes: Record<string, SerializedDeviceAttribute>;
    config: Record<string, unknown>;
}

export type SerializedSlvCtrlPlusDevice = SerializedDeviceBase & {
    type: 'slvCtrlPlus';
    deviceModel: string;
    fwVersion: number;
    protocolVersion: number;
}

export type SerializedButtplugIoDevice = SerializedDeviceBase & {
    type: 'buttplugIo';
    deviceModel: string;
}

export type SerializedVirtualDevice = SerializedDeviceBase & {
    type: 'virtual';
    deviceModel: string;
    fwVersion: string;
}

export type SerializedZc95Device = SerializedDeviceBase & {
    type: 'zc95';
    fwVersion: string;
}

export type SerializedEStim2bDevice = SerializedDeviceBase & {
    type: 'estim2b';
    fwVersion: string;
}

export type SerializedDevice =
    | SerializedSlvCtrlPlusDevice
    | SerializedButtplugIoDevice
    | SerializedVirtualDevice
    | SerializedZc95Device
    | SerializedEStim2bDevice;
