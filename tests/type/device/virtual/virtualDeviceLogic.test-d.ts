import { expectTypeOf } from 'vitest';
import type { AttributeKeyOf } from '../../../../src/device/device.js';
import type { NoDeviceConfig } from '../../../../src/device/deviceConfig.js';
import type { ExtractAttributes, ExtractConfig } from '../../../../src/device/protocol/virtual/virtualDeviceLogic.js';
import type TtsVirtualDeviceLogic from '../../../../src/device/protocol/virtual/audio/ttsVirtualDeviceLogic.js';
import type { TtsVirtualDeviceConfig } from '../../../../src/device/protocol/virtual/audio/ttsVirtualDeviceConfig.js';
import type PiperVirtualDeviceLogic from '../../../../src/device/protocol/virtual/audio/piperVirtualDeviceLogic.js';
import type { PiperVirtualDeviceConfig } from '../../../../src/device/protocol/virtual/audio/piperVirtualDeviceConfig.js';
import type RandomGeneratorVirtualDeviceLogic from '../../../../src/device/protocol/virtual/randomGenerator/randomGeneratorVirtualDeviceLogic.js';
import type { RandomGeneratorVirtualDeviceConfig } from '../../../../src/device/protocol/virtual/randomGenerator/randomGeneratorVirtualDeviceConfig.js';
import type DisplayVirtualDeviceLogic from '../../../../src/device/protocol/virtual/display/displayVirtualDeviceLogic.js';

// TtsVirtualDeviceLogic: text, speaking, queuing, queueLength
expectTypeOf<AttributeKeyOf<ExtractAttributes<TtsVirtualDeviceLogic>>>()
    .toEqualTypeOf<'text' | 'speaking' | 'queuing' | 'queueLength'>();
expectTypeOf<ExtractConfig<TtsVirtualDeviceLogic>>().toEqualTypeOf<TtsVirtualDeviceConfig>();

// PiperVirtualDeviceLogic: text, queuing (overlapping key names with Tts, but a distinct logic/attribute set)
expectTypeOf<AttributeKeyOf<ExtractAttributes<PiperVirtualDeviceLogic>>>()
    .toEqualTypeOf<'text' | 'queuing'>();
expectTypeOf<ExtractConfig<PiperVirtualDeviceLogic>>().toEqualTypeOf<PiperVirtualDeviceConfig>();

// RandomGeneratorVirtualDeviceLogic: value
expectTypeOf<AttributeKeyOf<ExtractAttributes<RandomGeneratorVirtualDeviceLogic>>>()
    .toEqualTypeOf<'value'>();
expectTypeOf<ExtractConfig<RandomGeneratorVirtualDeviceLogic>>().toEqualTypeOf<RandomGeneratorVirtualDeviceConfig>();

// DisplayVirtualDeviceLogic: content, and no explicit config -> defaults to NoDeviceConfig
expectTypeOf<AttributeKeyOf<ExtractAttributes<DisplayVirtualDeviceLogic>>>()
    .toEqualTypeOf<'content'>();
expectTypeOf<ExtractConfig<DisplayVirtualDeviceLogic>>().toEqualTypeOf<NoDeviceConfig>();
