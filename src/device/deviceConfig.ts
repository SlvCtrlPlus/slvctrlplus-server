import { Type, Static, TObject } from '@sinclair/typebox';

export const noDeviceConfigSchema = Type.Object({}, { additionalProperties: false });
export type NoDeviceConfigSchema = typeof noDeviceConfigSchema;
export type NoDeviceConfig = Static<NoDeviceConfigSchema>;

export type AnyDeviceConfig = Static<TObject>;
