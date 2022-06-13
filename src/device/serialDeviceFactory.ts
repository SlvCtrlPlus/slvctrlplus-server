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

    public create(deviceInfoStr: string, syncPort: SynchronousSerialPort, portInfo: PortInfo): Device {
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
        }

        if (null === device) {
            throw new Error('Unknown device type: ' + deviceType);
        }

        this.settings.getKnownSerialDevices().set(portInfo.serialNumber, knownDevice);

        return device;
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
