import { Type, Static } from '@sinclair/typebox';

/**
 * `scanIntervalMs` defaults to 3000 when missing - `DeviceProviderManager` hydrates missing
 * fields with their schema `default` before validating/constructing, so `VirtualDeviceProvider`
 * itself can treat this as always present, without its own fallback logic.
 */
export const virtualDeviceProviderConfigSchema = Type.Object({
    scanIntervalMs: Type.Number({ minimum: 1, default: 3000 }),
}, {
    additionalProperties: false,
});

export type VirtualDeviceProviderConfigSchema = typeof virtualDeviceProviderConfigSchema;
export type VirtualDeviceProviderConfig = Static<VirtualDeviceProviderConfigSchema>;
