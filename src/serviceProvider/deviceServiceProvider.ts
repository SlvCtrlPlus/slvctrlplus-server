import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import DeviceManager from "../device/deviceManager.js";
import SlvCtrlPlusDeviceFactory from "../device/slvCtrlPlusDeviceFactory.js";
import DelegateDeviceUpdater from "../device/delegateDeviceUpdater.js";
import PlainToClassSerializer from "../serialization/plainToClassSerializer.js";
import UuidFactory from "../factory/uuidFactory.js";
import Settings from "../settings/settings.js";
import {adjectives, Config} from "unique-names-generator";
import DeviceNameGenerator from "../device/deviceNameGenerator.js";
import DeviceUpdaterInterface from "../device/deviceUpdaterInterface.js";
import {starWarsNouns} from "../util/dictionary.js";
import BufferedDeviceUpdater from "../device/bufferedDeviceUpdater.js";
import GenericDeviceUpdater from "../device/generic/genericDeviceUpdater.js";
import GenericSlvCtrlPlusDevice from "../device/generic/genericSlvCtrlPlusDevice.js";
import DeviceProvider from "../device/provider/deviceProvider.js";
import SlvCtrlPlusSerialDeviceProvider from "../device/provider/slvCtrlPlusSerialDeviceProvider.js";
import EventEmitter from "events";
import SerialDeviceTransportFactory from "../device/transport/serialDeviceTransportFactory.js";
import DateFactory from "../factory/dateFactory.js";

export default class DeviceServiceProvider implements ServiceProvider
{
    public register(container: Pimple): void {
        container.set('device.provider.serial', (): DeviceProvider => new SlvCtrlPlusSerialDeviceProvider(
           new EventEmitter(),
           container.get('device.serial.factory') as SlvCtrlPlusDeviceFactory,
           container.get('device.serial.transport.factory') as SerialDeviceTransportFactory
        ));

        container.set('device.manager', (): DeviceManager => {
            return new DeviceManager();
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

        container.set('device.factory', () => new SlvCtrlPlusDeviceFactory(
            container.get('factory.uuid') as UuidFactory,
            container.get('factory.date') as DateFactory,
            container.get('settings') as Settings,
            container.get('device.uniqueNameGenerator') as DeviceNameGenerator,
        ));

        container.set('device.updater', (): DeviceUpdaterInterface => {
            const plainToClass  = container.get('serializer.plainToClass') as PlainToClassSerializer;
            const deviceUpdater = new DelegateDeviceUpdater();

            deviceUpdater.add(GenericSlvCtrlPlusDevice, new GenericDeviceUpdater(plainToClass));

            return new BufferedDeviceUpdater(deviceUpdater);
        });
    }
}
