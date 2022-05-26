import { Pimple, ServiceProvider } from '@timesplinter/pimple';
import DeviceManager from "../device/deviceManager.js";
import SerialDeviceFactory from "../device/serialDeviceFactory.js";
import DelegateDeviceUpdater from "../device/delegateDeviceUpdater.js";
import AirValveDevice from "../device/airValve/airValveDevice.js";
import AirValveDeviceUpdater from "../device/airValve/airValveDeviceUpdater.js";
import PlainToClassSerializer from "../serialization/plainToClassSerializer.js";
import UuidFactory from "../factory/uuidFactory.js";
import Settings from "../settings/settings.js";
import {adjectives, Config} from "unique-names-generator";
import DeviceNameGenerator from "../device/deviceNameGenerator.js";
import DeviceUpdaterInterface from "../device/deviceUpdaterInterface.js";
import {starWarsNouns} from "../util/dictionary.js";
import Et312Device from "../device/et312/et312Device.js";
import Et312DeviceUpdater from "../device/et312/et312DeviceUpdater.js";

export default class DeviceServiceProvider implements ServiceProvider
{
    public register(container: Pimple): void {
        container.set('device.manager', (): DeviceManager => {
            return new DeviceManager(
                container.get('device.factory') as SerialDeviceFactory,
            );
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

        container.set('device.updater', (): DeviceUpdaterInterface => {
            const plainToClass  = container.get('serializer.plainToClass') as PlainToClassSerializer;
            const deviceUpdater = new DelegateDeviceUpdater();

            deviceUpdater.add(AirValveDevice, new AirValveDeviceUpdater(plainToClass));
            deviceUpdater.add(Et312Device, new Et312DeviceUpdater(plainToClass));

            return deviceUpdater;
        });
    }
}
