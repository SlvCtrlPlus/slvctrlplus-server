import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import DeviceManager from '../device/deviceManager.js';
import SlvCtrlPlusDeviceFactory from '../device/protocol/slvCtrlPlus/slvCtrlPlusDeviceFactory.js';
import { adjectives, Config } from 'unique-names-generator';
import DeviceNameGenerator from '../device/deviceNameGenerator.js';
import { starWarsNouns } from '../util/dictionary.js';
import BufferedDeviceUpdater from '../device/updater/bufferedDeviceUpdater.js';
import GenericDeviceUpdater from '../device/genericDeviceUpdater.js';
import EventEmitter from 'events';
import SerialDeviceTransportFactory from '../device/transport/serialDeviceTransportFactory.js';
import Device from '../device/device.js';
import DeviceProviderLoader from '../device/provider/deviceProviderLoader.js';
import SlvCtrlPlusSerialDeviceProvider from '../device/protocol/slvCtrlPlus/slvCtrlPlusSerialDeviceProvider.js';
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
import Zc95SerialDeviceProvider from '../device/protocol/zc95/zc95SerialDeviceProvider.js';
import SerialPortObserver from '../device/transport/serialPortObserver.js';
import Zc95DeviceFactory from '../device/protocol/zc95/zc95DeviceFactory.js';
import PiperVirtualDeviceLogic from '../device/protocol/virtual/audio/piperVirtualDeviceLogic.js';
import { piperVirtualDeviceConfigSchema } from '../device/protocol/virtual/audio/piperVirtualDeviceConfig.js';
import { noDeviceConfigSchema } from '../device/deviceConfig.js';
import {
    randomGeneratorVirtualDeviceConfigSchema
} from '../device/protocol/virtual/randomGenerator/randomGeneratorVirtualDeviceConfig.js';
import { ttsVirtualDeviceConfigSchema } from '../device/protocol/virtual/audio/ttsVirtualDeviceConfig.js';
import GenericVirtualDeviceLogicFactory from '../device/protocol/virtual/genericVirtualDeviceLogicFactory.js';
import GenericDeviceProviderFactory from '../device/provider/genericDeviceProviderFactory.js';
import EStim2bSerialDeviceProvider from '../device/protocol/estim2b/estim2bSerialDeviceProvider.js';
import Estim2bDeviceFactory from '../device/protocol/estim2b/estim2bDeviceFactory.js';

export default class DeviceServiceProvider implements ServiceProvider<ServiceMap> {
    public register(container: Pimple<ServiceMap>): void {
        container.set(
            'device.serial.transport.factory',
            () => new SerialDeviceTransportFactory()
        );

        container.set(
            'device.provider.factory.slvCtrlPlusSerial',
            () => new GenericDeviceProviderFactory(
                SlvCtrlPlusSerialDeviceProvider,
                container.get('factory.serialPort'),
                new EventEmitter(),
                container.get('device.serial.factory.slvCtrlPlus'),
                container.get('device.serial.transport.factory'),
                container.get('logger.default'),
            )
        );

        container.set(
            'device.provider.factory.buttplugIoWebsocket',
            () => new ButtplugIoWebsocketDeviceProviderFactory(
                new EventEmitter(),
                container.get('device.serial.factory.buttplugIo'),
                container.get('logger.default'),
            )
        );

        container.set('device.manager', (): DeviceManager => {
            return new DeviceManager(new EventEmitter(), new Map<string, Device>());
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

        container.set('device.serial.factory.slvCtrlPlus', () => new SlvCtrlPlusDeviceFactory(
            container.get('factory.uuid'),
            container.get('factory.date'),
            container.get('settings'),
            container.get('device.uniqueNameGenerator'),
            container.get('logger.default'),
        ));

        container.set('device.serial.factory.buttplugIo', () => new ButtplugIoDeviceFactory(
            container.get('factory.uuid'),
            container.get('factory.date'),
            container.get('settings'),
            container.get('logger.default'),
        ));

        container.set('device.factory.zc95', () => new Zc95DeviceFactory(
            container.get('factory.uuid'),
            container.get('factory.date'),
            container.get('settings'),
            container.get('device.uniqueNameGenerator'),
            container.get('logger.default'),
        ));

        container.set('device.factory.estim2b', () => new Estim2bDeviceFactory(
            container.get('factory.uuid'),
            container.get('factory.date'),
            container.get('settings'),
            container.get('device.uniqueNameGenerator'),
            container.get('logger.default'),
        ));

        container.set('device.provider.factory.virtual', () => new VirtualDeviceProviderFactory(
            new EventEmitter(),
            container.get('device.virtual.factory'),
            container.get('settings.manager'),
            container.get('logger.default'),
        ));

        container.set('device.virtual.factory', () => {
            const genericVirtualDeviceFactory = new GenericVirtualDeviceFactory(
                container.get('factory.date'),
                container.get('factory.validator.schema.json')
            );

            const logger = container.get('logger.default');

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

        container.set('device.provider.loader', (): DeviceProviderLoader => {
            return new DeviceProviderLoader(
                container.get('device.manager'),
                container.get('device.observer.serial'),
                container.get('settings'),
                new Map([
                    [
                        SlvCtrlPlusSerialDeviceProvider.providerName,
                        container.get('device.provider.factory.slvCtrlPlusSerial')
                    ],
                    [
                        ButtplugIoWebsocketDeviceProvider.providerName,
                        container.get('device.provider.factory.buttplugIoWebsocket')
                    ],
                    [
                        VirtualDeviceProvider.providerName,
                        container.get('device.provider.factory.virtual')
                    ],
                    [
                        Zc95SerialDeviceProvider.providerName,
                        container.get('device.provider.factory.zc95Serial')
                    ],
                    [
                        EStim2bSerialDeviceProvider.providerName,
                        container.get('device.provider.factory.estim2bSerial')
                    ],
                ]),
                container.get('logger.default'),
            );
        });

        container.set('device.provider.factory.zc95Serial', () => {
            return new GenericDeviceProviderFactory(
                Zc95SerialDeviceProvider,
                container.get('factory.serialPort'),
                new EventEmitter(),
                container.get('device.factory.zc95'),
                container.get('logger.default'),
            );
        });

        container.set('device.provider.factory.estim2bSerial', () => {
            return new GenericDeviceProviderFactory(
                EStim2bSerialDeviceProvider,
                container.get('factory.serialPort'),
                new EventEmitter(),
                container.get('device.factory.estim2b'),
                container.get('logger.default'),
            );
        });

        container.set('device.observer.serial', () => {
            return new SerialPortObserver(new EventEmitter(), container.get('logger.default'));
        })
    }
}
