import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import DeviceManager from "../device/deviceManager.js";
import SlvCtrlPlusDeviceFactory from "../device/protocol/slvCtrlPlus/slvCtrlPlusDeviceFactory.js";
import DelegateDeviceUpdater from "../device/updater/delegateDeviceUpdater.js";
import {adjectives, Config} from "unique-names-generator";
import DeviceNameGenerator from "../device/deviceNameGenerator.js";
import {starWarsNouns} from "../util/dictionary.js";
import BufferedDeviceUpdater from "../device/updater/bufferedDeviceUpdater.js";
import GenericDeviceUpdater from "../device/protocol/slvCtrlPlus/genericDeviceUpdater.js";
import GenericSlvCtrlPlusDevice from "../device/protocol/slvCtrlPlus/genericSlvCtrlPlusDevice.js";
import EventEmitter from "events";
import SerialDeviceTransportFactory from "../device/transport/serialDeviceTransportFactory.js";
import Device, {DeviceData} from "../device/device.js";
import SlvCtrlPlusSerialDeviceProviderFactory
    from "../device/protocol/slvCtrlPlus/slvCtrlPlusSerialDeviceProviderFactory.js";
import DeviceProviderLoader from "../device/provider/deviceProviderLoader.js";
import SlvCtrlPlusSerialDeviceProvider from "../device/protocol/slvCtrlPlus/slvCtrlPlusSerialDeviceProvider.js";
import ButtplugIoWebsocketDeviceProvider from "../device/protocol/buttplugIo/buttplugIoWebsocketDeviceProvider.js";
import ButtplugIoWebsocketDeviceProviderFactory
    from "../device/protocol/buttplugIo/buttplugIoWebsocketDeviceProviderFactory.js";
import ButtplugIoDeviceFactory from "../device/protocol/buttplugIo/buttplugIoDeviceFactory.js";
import ServiceMap from "../serviceMap.js";
import DelegatedVirtualDeviceFactory from "../device/protocol/virtual/delegatedVirtualDeviceFactory.js";
import VirtualDeviceProvider from "../device/protocol/virtual/virtualDeviceProvider.js";
import VirtualDeviceProviderFactory from "../device/protocol/virtual/virtualDeviceProviderFactory.js";
import GenericVirtualDeviceFactory from "../device/protocol/virtual/genericVirtualDeviceFactory.js";
import DisplayVirtualDeviceLogic from "../device/protocol/virtual/display/displayVirtualDeviceLogic.js";
import RandomGeneratorVirtualDeviceLogic from "../device/protocol/virtual/randomGenerator/randomGeneratorVirtualDeviceLogic.js";
import TtsVirtualDeviceLogic from "../device/protocol/virtual/audio/ttsVirtualDeviceLogic.js";
import Zc95SerialDeviceProviderFactory from "../device/protocol/zc95/zc95SerialDeviceProviderFactory.js";
import Zc95SerialDeviceProvider from "../device/protocol/zc95/zc95SerialDeviceProvider.js";
import SerialPortObserver from "../device/transport/serialPortObserver.js";
import Zc95DeviceFactory from "../device/protocol/zc95/zc95DeviceFactory.js";

export default class DeviceServiceProvider implements ServiceProvider<ServiceMap>
{
    public register(container: Pimple<ServiceMap>): void {
        container.set(
            'device.serial.transport.factory',
            () => new SerialDeviceTransportFactory()
        );

        container.set(
            'device.provider.factory.slvCtrlPlusSerial',
            () => new SlvCtrlPlusSerialDeviceProviderFactory(
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
            return new DeviceManager(new EventEmitter(), new Map<string, Device<DeviceData>>());
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

        container.set('device.provider.factory.virtual', () => new VirtualDeviceProviderFactory(
            new EventEmitter(),
            container.get('device.virtual.factory.delegated'),
            container.get('settings.manager'),
            container.get('logger.default'),
        ));

        container.set('device.virtual.factory.randomGenerator', () => new GenericVirtualDeviceFactory<RandomGeneratorVirtualDeviceLogic>(
            RandomGeneratorVirtualDeviceLogic,
            container.get('factory.date'),
        ));

        container.set('device.virtual.factory.display', () => new GenericVirtualDeviceFactory<DisplayVirtualDeviceLogic>(
            DisplayVirtualDeviceLogic,
            container.get('factory.date'),
        ));

        container.set('device.virtual.factory.tts', () => new GenericVirtualDeviceFactory<TtsVirtualDeviceLogic>(
            TtsVirtualDeviceLogic,
            container.get('factory.date'),
        ));

        container.set('device.virtual.factory.delegated', () => {
            const factory = new DelegatedVirtualDeviceFactory();

            factory.addDeviceFactory(container.get('device.virtual.factory.randomGenerator'))
            factory.addDeviceFactory(container.get('device.virtual.factory.display'))
            factory.addDeviceFactory(container.get('device.virtual.factory.tts'))

            return factory;
        });

        container.set('device.updater', () => {
            const plainToClass  = container.get('serializer.plainToClass');
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
                        SlvCtrlPlusSerialDeviceProvider.name,
                        container.get('device.provider.factory.slvCtrlPlusSerial')
                    ],
                    [
                        ButtplugIoWebsocketDeviceProvider.name,
                        container.get('device.provider.factory.buttplugIoWebsocket')
                    ],
                    [
                        VirtualDeviceProvider.name,
                        container.get('device.provider.factory.virtual')
                    ],
                    [
                        Zc95SerialDeviceProvider.name,
                        container.get('device.provider.factory.zc95Serial')
                    ],
                ]),
                container.get('logger.default'),
            );
        });

        container.set('device.provider.factory.zc95Serial', () => {
           return new Zc95SerialDeviceProviderFactory(
               new EventEmitter(),
               container.get('device.factory.zc95'),
               container.get('logger.default'),
           );
        });

        container.set('device.observer.serial', () => {
            return new SerialPortObserver(new EventEmitter(), container.get('device.serial.transport.factory'), container.get('logger.default'));
        })
    }
}
