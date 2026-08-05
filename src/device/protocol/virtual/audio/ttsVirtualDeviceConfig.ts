import { Type, Static } from '@sinclair/typebox';

type TtsVirtualDeviceConfigSchema = typeof ttsVirtualDeviceConfigSchema;

export const ttsVirtualDeviceConfigSchema = Type.Object({
    voice: Type.Optional(Type.String()),
});

export type TtsVirtualDeviceConfig = Static<TtsVirtualDeviceConfigSchema>;
