import { Type, Static } from '@sinclair/typebox';

export const randomGeneratorVirtualDeviceConfigSchema = Type.Transform(
  Type.Object({
    min: Type.Number(),
    max: Type.Number(),
  }, {
    additionalProperties: false,
  })
)
  .Decode((value) => {
    if (value.min >= value.max) {
      throw new Error(`min (${value.min}) must be less than or equal to max (${value.max})`);
    }
    return value;
  })
  .Encode((value) => value);

export type RandomGeneratorVirtualDeviceConfigSchema = typeof randomGeneratorVirtualDeviceConfigSchema;
export type RandomGeneratorVirtualDeviceConfig = Static<RandomGeneratorVirtualDeviceConfigSchema>;
