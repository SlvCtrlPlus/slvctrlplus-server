import { TSchema, Static } from '@sinclair/typebox';

type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;

export type ClassToPlainNormalizer<TClass, TargetSchema extends TSchema> = (value: TClass) => Static<TargetSchema>;

export type PlainToClassDenormalizer<TClass, SourceSchema extends TSchema> = (value: unknown, schema: SourceSchema) => TClass;
