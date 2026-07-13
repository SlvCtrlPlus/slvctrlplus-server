import { Type, Static } from '@sinclair/typebox';

export const buttplugIoWebsocketConfigSchema = Type.Object({
    address: Type.String(),
    autoScan: Type.Boolean(),
    useDeviceNameAsId: Type.Boolean(),
}, {
    additionalProperties: false,
});

export type ButtplugIoWebsocketConfigSchema = typeof buttplugIoWebsocketConfigSchema;
export type ButtplugIoWebsocketConfig = Static<ButtplugIoWebsocketConfigSchema>;
