import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import DeviceManager from "../device/deviceManager.js";
import SlvCtrlPlusDeviceFactory from "../device/protocol/slvCtrlPlus/slvCtrlPlusDeviceFactory.js";
import DelegateDeviceUpdater from "../device/updater/delegateDeviceUpdater.js";
import PlainToClassSerializer from "../serialization/plainToClassSerializer.js";
import UuidFactory from "../factory/uuidFactory.js";
import Settings from "../settings/settings.js";
import {adjectives, Config} from "unique-names-generator";
import DeviceNameGenerator from "../device/deviceNameGenerator.js";
import DeviceUpdaterInterface from "../device/updater/deviceUpdaterInterface.js";
import {starWarsNouns} from "../util/dictionary.js";
import BufferedDeviceUpdater from "../device/updater/bufferedDeviceUpdater.js";
import GenericDeviceUpdater from "../device/attribute/genericDeviceUpdater.js";
import GenericSlvCtrlPlusDevice from "../device/protocol/slvCtrlPlus/genericSlvCtrlPlusDevice.js";
import EventEmitter from "events";
import SerialDeviceTransportFactory from "../device/transport/serialDeviceTransportFactory.js";
import DateFactory from "../factory/dateFactory.js";
import Device from "../device/device.js";
import SlvCtrlPlusSerialDeviceProviderFactory
    from "../device/protocol/slvCtrlPlus/slvCtrlPlusSerialDeviceProviderFactory.js";
import DeviceProviderFactory from "../device/provider/deviceProviderFactory.js";
import DeviceProviderLoader from "../device/provider/deviceProviderLoader.js";
import SlvCtrlPlusSerialDeviceProvider from "../device/protocol/slvCtrlPlus/slvCtrlPlusSerialDeviceProvider.js";
import Logger from "../logging/Logger.js";

export default class DeviceServiceProvider implements ServiceProvider
{
    public register(container: Pimple): void {
        container.set(
            'device.serial.transport.factory',
            (): SerialDeviceTransportFactory => new SerialDeviceTransportFactory()
        );

        container.set(
            'device.provider.factory.slvCtrlPlusSerial',
            (): DeviceProviderFactory => new SlvCtrlPlusSerialDeviceProviderFactory(
                new EventEmitter(),
                container.get('device.serial.factory') as SlvCtrlPlusDeviceFactory,
                container.get('device.serial.transport.factory') as SerialDeviceTransportFactory,
                container.get('logger.default') as Logger
            )
        );

        container.set('device.manager', (): DeviceManager => {
            return new DeviceManager(new EventEmitter(), new Map<string, Device>());
        });

        container.set('device.uniqueNameGenerator', (): DeviceNameGenerator => {
            const config: Config = {
                dictionaries: [adjectives, starWarsNouns],
                length: 2,
                separator: ' ',
                style: 'capital'
            };

            return new DeviceNameGenerator(config);
        })

        container.set('device.serial.factory', () => new SlvCtrlPlusDeviceFactory(
            container.get('factory.uuid') as UuidFactory,
            container.get('factory.date') as DateFactory,
            container.get('settings') as Settings,
            container.get('device.uniqueNameGenerator') as DeviceNameGenerator,
            container.get('logger.default') as Logger,
        ));

        container.set('device.updater', (): DeviceUpdaterInterface => {
            const plainToClass  = container.get('serializer.plainToClass') as PlainToClassSerializer;
            const deviceUpdater = new DelegateDeviceUpdater();
            const logger = container.get('logger.default') as Logger;

            deviceUpdater.add(GenericSlvCtrlPlusDevice, new GenericDeviceUpdater(plainToClass, logger));

            return new BufferedDeviceUpdater(deviceUpdater);
        });

        container.set('device.provider.loader', (): DeviceProviderLoader => {
            return new DeviceProviderLoader(
                container.get('device.manager') as DeviceManager,
                container.get('settings') as Settings,
                new Map([
                    [
                        SlvCtrlPlusSerialDeviceProvider.name,
                        container.get('device.provider.factory.slvCtrlPlusSerial') as DeviceProviderFactory
                    ],
                ]),
                container.get('logger.default') as Logger,
            );
        });
    }
}
