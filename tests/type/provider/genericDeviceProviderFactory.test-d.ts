import { expectTypeOf } from 'vitest';
import GenericDeviceProviderFactory from '../../../src/device/provider/genericDeviceProviderFactory.js';
import Zc95SerialDeviceProvider from '../../../src/device/protocol/zc95/zc95SerialDeviceProvider.js';
import type DeviceManager from '../../../src/device/deviceManager.js';
import type SerialPortFactory from '../../../src/factory/serialPortFactory.js';
import type SerialPortObserver from '../../../src/device/transport/serialPortObserver.js';
import type SerialDeviceTransportFactory from '../../../src/device/transport/serialDeviceTransportFactory.js';
import type Zc95DeviceFactory from '../../../src/device/protocol/zc95/zc95DeviceFactory.js';
import type JsonSchemaValidatorFactory from '../../../src/schemaValidation/JsonSchemaValidatorFactory.js';
import type Logger from '../../../src/logging/Logger.js';

declare const deviceManager: DeviceManager;
declare const serialPortFactory: SerialPortFactory;
declare const serialPortObserver: SerialPortObserver;
declare const transportFactory: SerialDeviceTransportFactory;
declare const zc95DeviceFactory: Zc95DeviceFactory;
declare const jsonSchemaValidatorFactory: JsonSchemaValidatorFactory;
declare const logger: Logger;

const providerFactory = new GenericDeviceProviderFactory(
    Zc95SerialDeviceProvider,
    deviceManager,
    serialPortFactory,
    serialPortObserver,
    transportFactory,
    zc95DeviceFactory,
    jsonSchemaValidatorFactory,
    logger,
);

// create() must resolve to the concrete Zc95SerialDeviceProvider, not just AnyDeviceProvider
expectTypeOf(providerFactory.create()).toEqualTypeOf<Zc95SerialDeviceProvider>();

new GenericDeviceProviderFactory(
    Zc95SerialDeviceProvider,
    // @ts-expect-error wrong constructor argument type (string instead of DeviceManager) is rejected
    'not-a-device-manager',
    serialPortFactory,
    serialPortObserver,
    transportFactory,
    zc95DeviceFactory,
    jsonSchemaValidatorFactory,
    logger,
);
