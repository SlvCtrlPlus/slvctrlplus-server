import type GenericVirtualDeviceFactory from '../../../../src/device/protocol/virtual/genericVirtualDeviceFactory.js';
import type VirtualDeviceLogicFactory from '../../../../src/device/protocol/virtual/virtualDeviceLogicFactory.js';
import type TtsVirtualDeviceLogic from '../../../../src/device/protocol/virtual/audio/ttsVirtualDeviceLogic.js';
import { ttsVirtualDeviceConfigSchema } from '../../../../src/device/protocol/virtual/audio/ttsVirtualDeviceConfig.js';
import { randomGeneratorVirtualDeviceConfigSchema } from '../../../../src/device/protocol/virtual/randomGenerator/randomGeneratorVirtualDeviceConfig.js';

declare const factory: GenericVirtualDeviceFactory;
declare const ttsLogicFactory: VirtualDeviceLogicFactory<TtsVirtualDeviceLogic>;

// matching config schema (voice: optional string) for TtsVirtualDeviceLogic: compiles
factory.addLogicFactory(ttsLogicFactory, ttsVirtualDeviceConfigSchema);

// @ts-expect-error mismatched config schema (min/max numbers) does not match TtsVirtualDeviceLogic's config
factory.addLogicFactory(ttsLogicFactory, randomGeneratorVirtualDeviceConfigSchema);
