import type { Static, TObject } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';

export const noDeviceConfigSchema = Type.Object({}, { additionalProperties: false });

type NoDeviceConfigSchema = typeof noDeviceConfigSchema;

export type NoDeviceConfig = Static<NoDeviceConfigSchema>;
export type AnyDeviceConfig = Static<TObject>;
