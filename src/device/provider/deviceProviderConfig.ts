import { Type, Static } from '@sinclair/typebox';

/**
 * Distinct from `NoDeviceConfig` (src/device/deviceConfig.ts) even though it's the same
 * underlying shape - that one is for a *device's* own config (e.g. `DisplayVirtualDeviceLogic`),
 * this one is for a *provider's* config (e.g. `SlvCtrlPlusSerialDeviceProvider`, which has no
 * settings.json `DeviceSource.config` of its own). Kept separate for clarity at call sites, even
 * though nothing behaviorally distinguishes the two.
 */
export const noDeviceProviderConfigSchema = Type.Object({}, { additionalProperties: false });
export type NoDeviceProviderConfigSchema = typeof noDeviceProviderConfigSchema;
export type NoDeviceProviderConfig = Static<NoDeviceProviderConfigSchema>;
