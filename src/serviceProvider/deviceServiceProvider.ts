import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import DeviceManager from "../device/deviceManager.js";
import SerialDeviceFactory from "../device/serialDeviceFactory.js";
import ButtplugIoDeviceFactory from "../device/buttplugIoDeviceFactory.js";
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
import GenericDevice from "../device/generic/genericDevice.js";
import DeviceProvider from "../device/deviceProvider.js";
import SerialDeviceProvider from "../device/serialDeviceProvider.js";
import ButtplugIoDeviceProvider from "../device/buttplugIoDeviceProvider.js";
import EventEmitter from "events";

export default class DeviceServiceProvider implements ServiceProvider
{
    public register(container: Pimple): void {
        container.set('device.provider.serial', (): DeviceProvider => new SerialDeviceProvider(
           new EventEmitter(),
           container.get('device.factory') as SerialDeviceFactory
        ));

        container.set('device.provider.buttplug.io', (): DeviceProvider => new ButtplugIoDeviceProvider(
            new EventEmitter(),
            container.get('device.factory.buttplug.io') as ButtplugIoDeviceFactory
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

        container.set('device.factory', () => new SerialDeviceFactory(
            container.get('factory.uuid') as UuidFactory,
            container.get('settings') as Settings,
            container.get('device.uniqueNameGenerator') as DeviceNameGenerator,
        ));
        container.set('device.factory.buttplug.io', () => new ButtplugIoDeviceFactory(
            container.get('factory.uuid') as UuidFactory,
            container.get('settings') as Settings,
            container.get('device.uniqueNameGenerator') as DeviceNameGenerator,
        ));

        container.set('device.updater', (): DeviceUpdaterInterface => {
            const plainToClass  = container.get('serializer.plainToClass') as PlainToClassSerializer;
            const deviceUpdater = new DelegateDeviceUpdater();

            deviceUpdater.add(GenericDevice, new GenericDeviceUpdater(plainToClass));

            return new BufferedDeviceUpdater(deviceUpdater);
        });
    }
}
