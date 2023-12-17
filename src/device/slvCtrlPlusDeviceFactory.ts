import UuidFactory from "../factory/uuidFactory.js";
import Settings from "../settings/settings.js";
import KnownSerialDevice from "../settings/knownSerialDevice.js";
import Device from "./device.js";
import DeviceNameGenerator from "./deviceNameGenerator.js";
import GenericSlvCtrlPlusDevice from "./generic/genericSlvCtrlPlusDevice.js";
import DateFactory from "../factory/dateFactory.js";
import DeviceTransport from "./transport/deviceTransport.js";
import SlvCtrlPlusDeviceAttributeParser from "./slvCtrlPlusDeviceAttributeParser.js";

export default class SlvCtrlPlusDeviceFactory
{
    private readonly uuidFactory: UuidFactory;

    private readonly dateFactory: DateFactory;

    private readonly settings: Settings;

    private readonly nameGenerator: DeviceNameGenerator;

    public constructor(
        uuidFactory: UuidFactory,
        dateFactory: DateFactory,
        settings: Settings,
        nameGenerator: DeviceNameGenerator
    ) {
        this.uuidFactory = uuidFactory;
        this.dateFactory = dateFactory;
        this.settings = settings;
        this.nameGenerator = nameGenerator;
    }

    public async create(deviceInfoStr: string, transport: DeviceTransport): Promise<Device> {
        const [deviceType, deviceVersion, protocolVersion] = deviceInfoStr.split(';')[1].split(',');
        const deviceIdentifier = transport.getDeviceIdentifier();
        const knownDevice = this.createKnownDevice(deviceIdentifier, deviceType);

        const deviceAttrResponse = await transport.writeLineAndExpect('attributes');
        const deviceAttrs = SlvCtrlPlusDeviceAttributeParser.parseDeviceAttributes(deviceAttrResponse);

        const device = new GenericSlvCtrlPlusDevice(
            deviceVersion,
            knownDevice.id,
            knownDevice.name,
            deviceType,
            this.dateFactory.now(),
            transport,
            Number(protocolVersion),
            deviceAttrs
        );

        this.settings.getKnownSerialDevices().set(deviceIdentifier, knownDevice);

        return device;
    }

    private createKnownDevice(serialNo: string, deviceType: string): KnownSerialDevice {
        // @TODO reorganize the known and stored devices in the settings.json
        // Options:
        //   - one list for all devices of all sources, store source together with device
        //   - separate lists for each device source (serial, bluetooth, buttplug.io, etc)
        // Actually this could belong rather to the device manager's task. Question is how to detect device if
        // transport is unknown? Or isn't it? Since device provider returns a device with a transport from which the
        // serial number could be determined... maybe?
        if (this.settings.getKnownSerialDevices().has(serialNo)) {
            // Return already existing device if already known (previously detected serial number)
            return this.settings.getKnownSerialDevices().get(serialNo);
        }

        // Create a new device and return if not yet known (new serial number)
        const knownDevice = new KnownSerialDevice();

        knownDevice.id = this.uuidFactory.create();
        knownDevice.serialNo = serialNo;
        knownDevice.name = this.nameGenerator.generateName();
        knownDevice.type = deviceType;

        return knownDevice;
    }
}
