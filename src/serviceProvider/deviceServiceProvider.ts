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
import Device from "../device/device.js";
import SlvCtrlPlusSerialDeviceProviderFactory
    from "../device/protocol/slvCtrlPlus/slvCtrlPlusSerialDeviceProviderFactory.js";
import DeviceProviderLoader from "../device/provider/deviceProviderLoader.js";
import SlvCtrlPlusSerialDeviceProvider from "../device/protocol/slvCtrlPlus/slvCtrlPlusSerialDeviceProvider.js";
import ButtplugIoWebsocketDeviceProvider from "../device/protocol/buttplugIo/buttplugIoWebsocketDeviceProvider.js";
import ButtplugIoWebsocketDeviceProviderFactory
    from "../device/protocol/buttplugIo/buttplugIoWebsocketDeviceProviderFactory.js";
import ButtplugIoDevice from "../device/protocol/buttplugIo/buttplugIoDevice.js";
import ButtplugIoDeviceUpdater from "../device/protocol/buttplugIo/buttplugIoDeviceUpdater.js";
import ServiceMap from "../serviceMap.js";

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
                container.get('device.factory.factory.buttplugIo'),
                container.get('logger.default')
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

        container.set('device.updater', () => {
            const plainToClass  = container.get('serializer.plainToClass');
            const deviceUpdater = new DelegateDeviceUpdater();
            const logger = container.get('logger.default');

            deviceUpdater.add(GenericSlvCtrlPlusDevice, new GenericDeviceUpdater(plainToClass, logger));
            deviceUpdater.add(ButtplugIoDevice, new ButtplugIoDeviceUpdater(plainToClass, logger));

            return new BufferedDeviceUpdater(deviceUpdater);
        });

        container.set('device.provider.loader', (): DeviceProviderLoader => {
            return new DeviceProviderLoader(
                container.get('device.manager'),
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
                ]),
                container.get('logger.default'),
            );
        });
    }
}
