import { Type, Static } from '@sinclair/typebox';

export const ttsVirtualDeviceConfigSchema = Type.Object({
  voice: Type.Optional(Type.String()),
});

export type TtsVirtualDeviceConfigSchema = typeof ttsVirtualDeviceConfigSchema;
export type TtsVirtualDeviceConfig = Static<TtsVirtualDeviceConfigSchema>;
