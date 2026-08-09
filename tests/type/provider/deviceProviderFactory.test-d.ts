import type DeviceProviderFactory from '../../../src/device/provider/deviceProviderFactory.js';
import type ButtplugIoWebsocketDeviceProvider from '../../../src/device/protocol/buttplugIo/buttplugIoWebsocketDeviceProvider.js';
import type ButtplugIoWebsocketDeviceProviderFactory from '../../../src/device/protocol/buttplugIo/buttplugIoWebsocketDeviceProviderFactory.js';
import type { JsonObject } from '../../../src/types.js';

declare const realFactory: ButtplugIoWebsocketDeviceProviderFactory;

// `DeviceProviderFactory<DP>` uses method syntax for `create()`, which is checked
// bivariantly - this lets a concrete factory narrow `config: JsonObject` down to
// its own concrete shape (as ButtplugIoWebsocketDeviceProviderFactory does) and
// still satisfy the interface:
const asInterface: DeviceProviderFactory<ButtplugIoWebsocketDeviceProvider> = realFactory;

// Contrast: if `create` were declared with property syntax instead
// (`create: (config: JsonObject) => DP`), it would be checked contravariantly and
// correctly reject the same narrowing - this is exactly the trap the inline
// comment on DeviceProviderFactory documents.
type PropertySyntaxVariant<DP> = { create: (config: JsonObject) => DP };
declare const narrowConfigFactory: { create: (config: { address: string }) => ButtplugIoWebsocketDeviceProvider };

// @ts-expect-error property-syntax `create` is contravariant in its parameter and rejects this narrowing
const asPropertyVariant: PropertySyntaxVariant<ButtplugIoWebsocketDeviceProvider> = narrowConfigFactory;
