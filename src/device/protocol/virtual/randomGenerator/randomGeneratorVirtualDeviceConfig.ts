import { Type, Static } from '@sinclair/typebox';

export const randomGeneratorVirtualDeviceConfigSchema = Type.Object({
    min: Type.Number(),
    max: Type.Number(),
}, {
    additionalProperties: false,
});

export type RandomGeneratorVirtualDeviceConfigSchema = typeof randomGeneratorVirtualDeviceConfigSchema;
export type RandomGeneratorVirtualDeviceConfig = Static<RandomGeneratorVirtualDeviceConfigSchema>;
