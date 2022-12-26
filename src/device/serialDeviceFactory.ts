import AirValveDevice from "./airValve/airValveDevice.js";
import SynchronousSerialPort from "../serial/SynchronousSerialPort.js";
import UuidFactory from "../factory/uuidFactory.js";
import {PortInfo} from "@serialport/bindings-interface/dist/index.js";
import Settings from "../settings/settings.js";
import KnownSerialDevice from "../settings/knownSerialDevice.js";
import Device from "./device.js";
import DeviceNameGenerator from "./deviceNameGenerator.js";
import Et312Device from "./et312/et312Device.js";
import StrikerMk2Device from "./strikerMk2/strikerMk2Device.js";
import DistanceDevice from "./distance/distanceDevice.js";
import GenericDevice from "./genericDevice";
import GenericDeviceAttribute from "./generic/genericDeviceAttribute";
import SerialDevice from "./serialDevice";

export default class SerialDeviceFactory
{
    private readonly uuidFactory: UuidFactory;

    private readonly settings: Settings;

    private readonly nameGenerator: DeviceNameGenerator;

    public constructor(uuidFactory: UuidFactory, settings: Settings, nameGenerator: DeviceNameGenerator) {
        this.uuidFactory = uuidFactory;
        this.settings = settings;
        this.nameGenerator = nameGenerator;
    }

    public async create(deviceInfoStr: string, syncPort: SynchronousSerialPort, portInfo: PortInfo): Promise<Device|null> {
        const [deviceType, deviceVersion] = deviceInfoStr.split(',');

        const knownDevice = this.createKnownDevice(portInfo.serialNumber, deviceType);
        let device: Device = null;

        if ('air_valve' === deviceType) {
            device = new AirValveDevice(
                deviceVersion,
                knownDevice.id,
                knownDevice.name,
                new Date(),
                syncPort,
                portInfo
            );
        } else if ('et312' === deviceType) {
            device = new Et312Device(
                deviceVersion,
                knownDevice.id,
                knownDevice.name,
                new Date(),
                syncPort,
                portInfo
            );
        } else if ('strikerMk2' === deviceType) {
            device = new StrikerMk2Device(
                deviceVersion,
                knownDevice.id,
                knownDevice.name,
                new Date(),
                syncPort,
                portInfo
            );
        } else if ('distance' === deviceType) {
            device = new DistanceDevice(
                deviceVersion,
                knownDevice.id,
                knownDevice.name,
                new Date(),
                syncPort,
                portInfo
            );
        } else {
            const deviceAttrResponse = await syncPort.writeLineAndExpect('attributes');
            const deviceAttrs = SerialDeviceFactory.parseDeviceAttributes(deviceAttrResponse);

            device = new GenericDevice(
                deviceVersion,
                knownDevice.id,
                knownDevice.name,
                new Date(),
                syncPort,
                portInfo,
                deviceAttrs
            );
        }

        if (null === device) {
            throw new Error('Unknown device type: ' + deviceType);
        }

        this.settings.getKnownSerialDevices().set(portInfo.serialNumber, knownDevice);

        return device;
    }

    private static parseDeviceAttributes(response: string): GenericDeviceAttribute[] {
        return [];
    }

    private createKnownDevice(serialNo: string, deviceType: string): KnownSerialDevice {
        if (this.settings.getKnownSerialDevices().has(serialNo)) {
            return this.settings.getKnownSerialDevices().get(serialNo);
        }

        const knownDevice = new KnownSerialDevice();

        knownDevice.id = this.uuidFactory.create();
        knownDevice.serialNo = serialNo;
        knownDevice.name = this.nameGenerator.generateName();
        knownDevice.type = deviceType;

        return knownDevice;
    }
}
