import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import DeviceManager from '../device/deviceManager.js';
import SlvCtrlPlusDeviceFactory from '../device/protocol/slvCtrlPlus/slvCtrlPlusDeviceFactory.js';
import { adjectives, Config } from 'unique-names-generator';
import DeviceNameGenerator from '../device/deviceNameGenerator.js';
import { starWarsNouns } from '../util/dictionary.js';
import BufferedDeviceUpdater from '../device/updater/bufferedDeviceUpdater.js';
import GenericDeviceUpdater from '../device/genericDeviceUpdater.js';
import SerialDeviceTransportFactory from '../device/transport/serialDeviceTransportFactory.js';
import Device from '../device/device.js';
import DeviceProviderManager from '../device/provider/deviceProviderManager.js';
import ButtplugIoWebsocketDeviceProvider from '../device/protocol/buttplugIo/buttplugIoWebsocketDeviceProvider.js';
import ButtplugIoWebsocketDeviceProviderFactory
    from '../device/protocol/buttplugIo/buttplugIoWebsocketDeviceProviderFactory.js';
import ButtplugIoDeviceFactory from '../device/protocol/buttplugIo/buttplugIoDeviceFactory.js';
import ServiceMap from '../serviceMap.js';
import VirtualDeviceProvider from '../device/protocol/virtual/virtualDeviceProvider.js';
import VirtualDeviceProviderFactory from '../device/protocol/virtual/virtualDeviceProviderFactory.js';
import GenericVirtualDeviceFactory from '../device/protocol/virtual/genericVirtualDeviceFactory.js';
import DisplayVirtualDeviceLogic from '../device/protocol/virtual/display/displayVirtualDeviceLogic.js';
import RandomGeneratorVirtualDeviceLogic
    from '../device/protocol/virtual/randomGenerator/randomGeneratorVirtualDeviceLogic.js';
import TtsVirtualDeviceLogic from '../device/protocol/virtual/audio/ttsVirtualDeviceLogic.js';
import Zc95DeviceFactory from '../device/protocol/zc95/zc95DeviceFactory.js';
import PiperVirtualDeviceLogic from '../device/protocol/virtual/audio/piperVirtualDeviceLogic.js';
import { piperVirtualDeviceConfigSchema } from '../device/protocol/virtual/audio/piperVirtualDeviceConfig.js';
import { noDeviceConfigSchema } from '../device/deviceConfig.js';
import {
    randomGeneratorVirtualDeviceConfigSchema
} from '../device/protocol/virtual/randomGenerator/randomGeneratorVirtualDeviceConfig.js';
import { ttsVirtualDeviceConfigSchema } from '../device/protocol/virtual/audio/ttsVirtualDeviceConfig.js';
import GenericVirtualDeviceLogicFactory from '../device/protocol/virtual/genericVirtualDeviceLogicFactory.js';
import Estim2bDeviceFactory from '../device/protocol/estim2b/estim2bDeviceFactory.js';
import BleDeviceProvider from '../device/provider/bleDeviceProvider.js';
import AiroticDeviceFactory from '../device/protocol/airotic/airoticDeviceFactory.js';
import SerialDeviceProvider from '../device/provider/serialDeviceProvider.js';
import DeviceProviderFactory from '../device/provider/deviceProviderFactory.js';
import { DeviceId } from '../device/deviceId.js';
import KnownDeviceResolver from '../device/knownDeviceResolver.js';

export default class DeviceServiceProvider implements ServiceProvider<ServiceMap> {
    public register(container: Pimple<ServiceMap>): void {
        container.set(
            'device.serial.transport.factory',
            () => new SerialDeviceTransportFactory()
        );

        container.set(
            'device.provider.factory.buttplugIoWebsocket',
            () => new ButtplugIoWebsocketDeviceProviderFactory(
                container.get('device.manager'),
                container.get('factory.eventEmitter').create(),
                container.get('device.knownDeviceResolver'),
                container.get('device.serial.factory.buttplugIo'),
                container.get('logger.default'),
            )
        );

        container.set('device.manager', (): DeviceManager => {
            return new DeviceManager(
                container.get('factory.eventEmitter').create(),
                new Map<DeviceId, Device>(),
                container.get('logger.default')
            );
        });

        container.set('device.uniqueNameGenerator', () => {
            const config: Config = {
                dictionaries: [adjectives, starWarsNouns],
                length: 2,
                separator: ' ',
                style: 'capital'
            };

            return new DeviceNameGenerator(config);
        })

        container.set('device.knownDeviceResolver', () => new KnownDeviceResolver(
            container.get('settings'),
            container.get('device.uniqueNameGenerator'),
            container.get('logger.default'),
        ));

        container.set('device.serial.factory.slvCtrlPlus', () => new SlvCtrlPlusDeviceFactory(
            container.get('factory.date'),
            container.get('factory.eventEmitter'),
            container.get('device.knownDeviceResolver'),
            container.get('device.serial.transport.factory'),
            container.get('logger.default'),
        ));

        container.set('device.serial.factory.buttplugIo', () => new ButtplugIoDeviceFactory(
            container.get('factory.date'),
            container.get('factory.eventEmitter'),
            container.get('logger.default'),
        ));

        container.set('device.factory.zc95', () => new Zc95DeviceFactory(
            container.get('factory.date'),
            container.get('factory.eventEmitter'),
            container.get('settings'),
            container.get('device.uniqueNameGenerator'),
            container.get('device.serial.transport.factory'),
            container.get('logger.default'),
        ));

        container.set('device.factory.estim2b', () => new Estim2bDeviceFactory(
            container.get('factory.date'),
            container.get('factory.eventEmitter'),
            container.get('settings'),
            container.get('device.uniqueNameGenerator'),
            container.get('device.serial.transport.factory'),
            container.get('logger.default'),
        ));

        container.set('device.factory.airotic', () => new AiroticDeviceFactory(
            container.get('device.knownDeviceResolver'),
            container.get('logger.default'),
        ));

        container.set('device.provider.factory.virtual', () => new VirtualDeviceProviderFactory(
            container.get('device.manager'),
            container.get('factory.eventEmitter'),
            container.get('device.virtual.factory'),
            container.get('settings.manager'),
            container.get('logger.default'),
        ));

        container.set('device.virtual.factory', () => {
            const logger = container.get('logger.default');

            const genericVirtualDeviceFactory = new GenericVirtualDeviceFactory(
                container.get('factory.date'),
                container.get('factory.eventEmitter'),
                container.get('factory.validator.schema.json'),
                logger,
            );

            genericVirtualDeviceFactory
                .addLogicFactory(
                    GenericVirtualDeviceLogicFactory.from(RandomGeneratorVirtualDeviceLogic, logger),
                    randomGeneratorVirtualDeviceConfigSchema,
                )
                .addLogicFactory(
                    GenericVirtualDeviceLogicFactory.from(DisplayVirtualDeviceLogic, logger),
                    noDeviceConfigSchema,
                )
                .addLogicFactory(
                    GenericVirtualDeviceLogicFactory.from(TtsVirtualDeviceLogic, logger),
                    ttsVirtualDeviceConfigSchema,
                )
                .addLogicFactory(
                    GenericVirtualDeviceLogicFactory.from(PiperVirtualDeviceLogic, logger),
                    piperVirtualDeviceConfigSchema,
                )
            ;

            return genericVirtualDeviceFactory;
        })

        container.set('device.updater', () => {
            const plainToClass = container.get('serializer.plainToClass');
            const logger = container.get('logger.default');
            const deviceUpdater = new GenericDeviceUpdater(plainToClass, logger);

            return new BufferedDeviceUpdater(deviceUpdater);
        });

        container.set('device.provider.loader', (): DeviceProviderManager => {
            return new DeviceProviderManager(
                new Map<string, DeviceProviderFactory<any>>([
                    [
                        ButtplugIoWebsocketDeviceProvider.providerName,
                        container.get('device.provider.factory.buttplugIoWebsocket'),
                    ],
                    [
                        VirtualDeviceProvider.providerName,
                        container.get('device.provider.factory.virtual'),
                    ],
                ]),
                container.get('logger.default'),
            );
        });

        container.set('device.provider.serial', () => {
            const provider = new SerialDeviceProvider(
                container.get('device.manager'),
                container.get('factory.serialPort'),
                container.get('factory.eventEmitter').create(),
                container.get('logger.default'),
            );

            const serialFactoriesByProtocolName = new Map<string, () => void>([
                [SlvCtrlPlusDeviceFactory.protocolName, (): void => { provider.registerFactory(container.get('device.serial.factory.slvCtrlPlus')); }],
                [Zc95DeviceFactory.protocolName, (): void => { provider.registerFactory(container.get('device.factory.zc95')); }],
                [Estim2bDeviceFactory.protocolName, (): void => { provider.registerFactory(container.get('device.factory.estim2b')); }],
            ]);

            for (const [, deviceSource] of container.get('settings').getDeviceSources()) {
                serialFactoriesByProtocolName.get(deviceSource.type)?.();
            }

            return provider;
        });

        container.set('device.provider.ble', () => {
            const provider = new BleDeviceProvider(
                container.get('device.manager'),
                container.get('factory.eventEmitter').create(),
                container.get('logger.default'),
            );

            const bleFactoriesByProtocolName = new Map<string, () => void>([
                [AiroticDeviceFactory.protocolName, (): void => { provider.registerFactory(container.get('device.factory.airotic')); }],
            ]);

            for (const [, deviceSource] of container.get('settings').getDeviceSources()) {
                bleFactoriesByProtocolName.get(deviceSource.type)?.();
            }

            return provider;
        });
    }
}
