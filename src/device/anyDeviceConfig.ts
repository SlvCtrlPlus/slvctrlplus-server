import { Type, Static } from '@sinclair/typebox';

export const anyDeviceConfigSchema = Type.Record(Type.String(), Type.Unknown());
export type AnyDeviceConfigSchema = typeof anyDeviceConfigSchema;
export type AnyDeviceConfig = Static<AnyDeviceConfigSchema>;
