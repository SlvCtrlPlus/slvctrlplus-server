import UuidFactory from "../../../factory/uuidFactory.js";
import Settings from "../../../settings/settings.js";
import KnownDevice from "../../../settings/knownDevice.js";
import Device from "../../device.js";
import DeviceNameGenerator from "../../deviceNameGenerator.js";
import GenericSlvCtrlPlusDevice from "./genericSlvCtrlPlusDevice.js";
import DateFactory from "../../../factory/dateFactory.js";
import DeviceTransport from "../../transport/deviceTransport.js";
import SlvCtrlPlusMessageParser from "./slvCtrlPlusMessageParser.js";
import Logger from "../../../logging/Logger.js";

export default class SlvCtrlPlusDeviceFactory
{
    private readonly uuidFactory: UuidFactory;

    private readonly dateFactory: DateFactory;

    private readonly settings: Settings;

    private readonly nameGenerator: DeviceNameGenerator;

    private readonly logger: Logger;

    public constructor(
        uuidFactory: UuidFactory,
        dateFactory: DateFactory,
        settings: Settings,
        nameGenerator: DeviceNameGenerator,
        logger: Logger
    ) {
        this.uuidFactory = uuidFactory;
        this.dateFactory = dateFactory;
        this.settings = settings;
        this.nameGenerator = nameGenerator;
        this.logger = logger;
    }

    public async create(deviceInfoStr: string, transport: DeviceTransport, provider: string): Promise<Device> {
        const [deviceType, deviceVersion, protocolVersion] = deviceInfoStr.split(';')[1].split(',');
        const deviceIdentifier = transport.getDeviceIdentifier();
        const knownDevice = this.createKnownDevice(deviceIdentifier, deviceType, provider);

        const deviceAttrResponse = await transport.sendAndAwaitReceive("attributes\n");
        const deviceAttrs = SlvCtrlPlusMessageParser.parseDeviceAttributes(deviceAttrResponse);

        const device = new GenericSlvCtrlPlusDevice(
            deviceVersion,
            knownDevice.id,
            knownDevice.name,
            deviceType,
            provider,
            this.dateFactory.now(),
            transport,
            Number(protocolVersion),
            deviceAttrs
        );

        this.settings.addKnownDevice(knownDevice);

        return device;
    }

    private createKnownDevice(serialNo: string, deviceType: string, provider: string): KnownDevice {
        let knownDevice = this.settings.getKnownDeviceById(serialNo)

        if (null !== knownDevice) {
            // Return already existing device if already known (previously detected serial number)
            this.logger.debug(`Device is already known: ${knownDevice.id} (${serialNo})`);
            return this.settings.getKnownDevices().get(serialNo);
        }

        // Create a new device and return if not yet known (new serial number)
        knownDevice = new KnownDevice();

        knownDevice.id = this.uuidFactory.create();
        knownDevice.serialNo = serialNo;
        knownDevice.name = this.nameGenerator.generateName();
        knownDevice.type = deviceType;
        knownDevice.source = provider;
        knownDevice.config = {};

        return knownDevice;
    }
}
