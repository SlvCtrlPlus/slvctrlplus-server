import UuidFactory from "../../../factory/uuidFactory.js";
import Settings from "../../../settings/settings.js";
import {ButtplugClientDevice} from "buttplug";
import ButtplugIoDevice from "./buttplugIoDevice.js";
import KnownDevice from "../../../settings/knownDevice.js";
import Logger from "../../../logging/Logger.js";
import GenericDeviceAttribute, {GenericDeviceAttributeModifier} from "../../attribute/genericDeviceAttribute.js";
import FloatGenericDeviceAttribute from "../../attribute/floatGenericDeviceAttribute.js";
import RangeGenericDeviceAttribute from "../../attribute/rangeGenericDeviceAttribute.js";
import BoolGenericDeviceAttribute from "../../attribute/boolGenericDeviceAttribute.js";
import DateFactory from "../../../factory/dateFactory.js";


export default class ButtplugIoDeviceFactory
{
    private readonly uuidFactory: UuidFactory;

    private readonly dateFactory: DateFactory;

    private readonly settings: Settings;

    private readonly logger: Logger;

    public constructor(uuidFactory: UuidFactory, dateFactory: DateFactory, settings: Settings, logger: Logger) {
        this.uuidFactory = uuidFactory;
        this.dateFactory = dateFactory;
        this.settings = settings;
        this.logger = logger;
    }

    public create(buttplugDevice: ButtplugClientDevice, provider: string): ButtplugIoDevice {
        const knownDevice = this.createKnownDevice(buttplugDevice, provider);

        const deviceAttrs = ButtplugIoDeviceFactory.parseDeviceAttributes(buttplugDevice);

        const device = new ButtplugIoDevice(
            knownDevice.id,
            knownDevice.name,
            buttplugDevice.name,
            provider,
            this.dateFactory.now(),
            buttplugDevice,
            deviceAttrs,
        );

        if (null === device) {
            throw new Error('Unknown device type: ' + knownDevice.name);
        }

        this.settings.addKnownDevice(knownDevice);

        return device;
    }

    private static parseDeviceAttributes(buttplugDevice: ButtplugClientDevice): GenericDeviceAttribute[] {
        const attributeList: GenericDeviceAttribute[] = [];

        for (const item of buttplugDevice.messageAttributes.ScalarCmd) {
            let attr = null;

            if (item.StepCount > 2) {
                attr = new RangeGenericDeviceAttribute();
                attr.min = 0;
                attr.max = item.StepCount;
            } else {
                attr = new BoolGenericDeviceAttribute();
            }

            attr.name = `${item.ActuatorType}-${item.Index}`;
            attr.modifier = GenericDeviceAttributeModifier.writeOnly;

            attributeList.push(attr);
        }

        for (const item of buttplugDevice.messageAttributes.SensorReadCmd) {
            const attr = new FloatGenericDeviceAttribute()
            attr.name = `${item.SensorType}-${item.Index}`;
            attr.modifier = GenericDeviceAttributeModifier.readOnly;

            attributeList.push(attr);
        }

        return attributeList;
    }

    private createKnownDevice(buttplugDevice: ButtplugClientDevice, provider: string): KnownDevice {
        let knownDevice = this.settings.getKnownDeviceById(buttplugDevice.name)

        if (null !== knownDevice) {
            // Return already existing device if already known (previously detected serial number)
            this.logger.debug(`Device is already known: ${knownDevice.id} (${buttplugDevice.name})`);
            return this.settings.getKnownDevices().get(buttplugDevice.name);
        }

        knownDevice = new KnownDevice();

        knownDevice.id = this.uuidFactory.create();
        knownDevice.serialNo = buttplugDevice.name;
        knownDevice.name = buttplugDevice.displayName !== undefined ? buttplugDevice.displayName : buttplugDevice.name;
        knownDevice.type = buttplugDevice.name;
        knownDevice.source = provider;

        return knownDevice;
    }
}