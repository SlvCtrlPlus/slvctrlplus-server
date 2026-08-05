import DeviceState from './deviceState.js';
import { DeviceAttributeModifier } from './attribute/deviceAttribute.js';
import { DeviceId } from './deviceId.js';

type SerializedDeviceAttributeBase = {
    name: string;
    label: string | undefined;
    modifier: DeviceAttributeModifier;
    type: string;
};

type SerializedIntRangeDeviceAttribute = SerializedDeviceAttributeBase & {
    type: 'range';
    value: number | undefined;
    min: number;
    max: number;
    incrementStep: number;
    uom: string | undefined;
};

type SerializedIntDeviceAttribute = SerializedDeviceAttributeBase & {
    type: 'int';
    value: number | undefined;
    uom: string | undefined;
};

type SerializedFloatDeviceAttribute = SerializedDeviceAttributeBase & {
    type: 'float';
    value: number | undefined;
    uom: string | undefined;
};

type SerializedBoolDeviceAttribute = SerializedDeviceAttributeBase & {
    type: 'bool';
    value: boolean | undefined;
};

type SerializedStrDeviceAttribute = SerializedDeviceAttributeBase & {
    type: 'str';
    value: string | undefined;
};

type SerializedListDeviceAttribute = SerializedDeviceAttributeBase & {
    type: 'list';
    value: string | number | undefined;
    values: { key: string | number, value: string | number }[];
};

type SerializedDeviceAttribute =
    | SerializedIntRangeDeviceAttribute
    | SerializedIntDeviceAttribute
    | SerializedFloatDeviceAttribute
    | SerializedBoolDeviceAttribute
    | SerializedStrDeviceAttribute
    | SerializedListDeviceAttribute;

type SerializedDeviceBase = {
    connectedSince: Date;
    deviceId: DeviceId;
    deviceName: string;
    provider: string;
    state: DeviceState;
    errorInfo: { reason: string, occurredAt: Date } | undefined;
    controllable: boolean;
    lastRefresh: Date | undefined;
    attributes: Record<string, SerializedDeviceAttribute>;
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
