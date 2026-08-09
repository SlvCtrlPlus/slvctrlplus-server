import { expectTypeOf } from 'vitest';
import type JsonSchemaValidator from '../../../src/schemaValidation/JsonSchemaValidator.js';
import { randomGeneratorVirtualDeviceConfigSchema } from '../../../src/device/protocol/virtual/randomGenerator/randomGeneratorVirtualDeviceConfig.js';
import type { RandomGeneratorVirtualDeviceConfig } from '../../../src/device/protocol/virtual/randomGenerator/randomGeneratorVirtualDeviceConfig.js';

declare const validator: JsonSchemaValidator<typeof randomGeneratorVirtualDeviceConfigSchema>;
declare const data: unknown;

// before validate(): data is still unknown
expectTypeOf(data).toEqualTypeOf<unknown>();

if (validator.validate(data)) {
    // after a successful validate(), data narrows from unknown to the schema's Static<> type
    expectTypeOf(data).toEqualTypeOf<RandomGeneratorVirtualDeviceConfig>();
    expectTypeOf(data.min).toEqualTypeOf<number>();
    expectTypeOf(data.max).toEqualTypeOf<number>();
}
