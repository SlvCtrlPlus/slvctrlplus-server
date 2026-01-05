import { Type, Static } from '@sinclair/typebox';

export const piperVirtualDeviceConfigSchema = Type.Object({
  binary: Type.Optional(Type.String()),
  model: Type.String(),
});

export type PiperVirtualDeviceConfigSchema = typeof piperVirtualDeviceConfigSchema;
export type PiperVirtualDeviceConfig = Static<PiperVirtualDeviceConfigSchema>;
