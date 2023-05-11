import UuidFactory from "../factory/uuidFactory.js";
import {PortInfo} from "@serialport/bindings-interface/dist/index.js";
import Settings from "../settings/settings.js";
import KnownButtplugIoDevice from "../settings/knownButtplugIoDevice.js";
import Device from "./device.js";
import {ButtplugClientDevice} from "buttplug"
import DeviceNameGenerator from "./deviceNameGenerator.js";
import buttplugIoDevice from "./buttplugIoDevice.js";
import GenericDeviceAttribute, {GenericDeviceAttributeModifier} from "./generic/genericDeviceAttribute.js";
import BoolGenericDeviceAttribute from "./generic/boolGenericDeviceAttribute.js";
import FloatGenericDeviceAttribute from "./generic/floatGenericDeviceAttribute.js";
import StrGenericDeviceAttribute from "./generic/strGenericDeviceAttribute.js";
import RangeGenericDeviceAttribute from "./generic/rangeGenericDeviceAttribute.js";
import ListGenericDeviceAttribute from "./generic/listGenericDeviceAttribute.js";
import IntGenericDeviceAttribute from "./generic/intGenericDeviceAttribute.js";

export default class ButtplugIoDeviceFactory
{
    private readonly uuidFactory: UuidFactory;

    private readonly settings: Settings;

    private readonly nameGenerator: DeviceNameGenerator;

    public constructor(uuidFactory: UuidFactory, settings: Settings, nameGenerator: DeviceNameGenerator) {
        this.uuidFactory = uuidFactory;
        this.settings = settings;
        this.nameGenerator = nameGenerator;
    }

    public async create(buttplugDevice: ButtplugClientDevice): Promise<Device> {
        console.log(buttplugDevice);

        const knownDevice = this.createKnownDevice(buttplugDevice);

        const deviceAttrs = ButtplugIoDeviceFactory.parseDeviceAttributes(buttplugDevice);

        const device = new buttplugIoDevice(
            knownDevice.id,
            knownDevice.name,
            buttplugDevice.name,
            new Date(),
            buttplugDevice,
            deviceAttrs,
        );

        if (null === device) {
            throw new Error('Unknown device type: ' + knownDevice.name);
        }

        this.settings.getKnownButtplugIoDevices().set(buttplugDevice.name, knownDevice);


        return device;

    }

    private static parseDeviceAttributes(buttplugDevice: ButtplugClientDevice): GenericDeviceAttribute[] {
        const attributeList = [];

        for (let i = 0; i < buttplugDevice.messageAttributes.ScalarCmd.length; i++) {
            const step = buttplugDevice.messageAttributes.ScalarCmd[i].StepCount > 2 ? "wo[0-100]" : "wo[bool]";
            console.log('messageAttribute : ', buttplugDevice.messageAttributes.ScalarCmd[i].ActuatorType, ', step : ', buttplugDevice.messageAttributes.ScalarCmd[i].StepCount, ' -> ', step);
            attributeList.push(this.createAttributeFromValue(
                buttplugDevice.messageAttributes.ScalarCmd[i].ActuatorType,
                step
            ));
        }
        for (let i = 0; i < buttplugDevice.messageAttributes.SensorReadCmd.length; i++) {
            const step = "ro[float]";
            console.log('SensorType : ',  buttplugDevice.messageAttributes.SensorReadCmd[i].SensorType, ', step : ', step);
            attributeList.push(this.createAttributeFromValue(
                buttplugDevice.messageAttributes.SensorReadCmd[i].SensorType,
                step
            ));
        }

        return attributeList;
    }

    private static createAttributeFromValue(name: string, definition: string): GenericDeviceAttribute {
        const re = /^(ro|rw|wo)\[(.+?)\]$/;
        const reRange = /^(\d+)-(\d+)$/;
        const reResult = re.exec(definition);
        const type = reResult[1];
        const value = reResult[2];
        let result: RegExpExecArray|null;
        let resultList: string[];

        const modifier = this.getAttributeTypeFromStr(type);

        let attr = null;

        if ('bool' === value) {
            attr = new BoolGenericDeviceAttribute();
        } else if ('int' === value) {
            attr = new IntGenericDeviceAttribute();
        } else if ('float' === value) {
            attr = new FloatGenericDeviceAttribute();
        } else if ('str' === value) {
            attr = new StrGenericDeviceAttribute();
        } else if (null !== (result = reRange.exec(value))) {
            attr = new RangeGenericDeviceAttribute();
            attr.min = Number(result[1]);
            attr.max = Number(result[2]);
        } else if ((resultList = value.split('|')).length > 0) {
            attr = new ListGenericDeviceAttribute();
            attr.values = resultList;
        } else {
            throw new Error(`Unknown attribute data type: ${value}`);
        }

        attr.name = name;
        attr.modifier = modifier;

        return attr;
    }

    private static getAttributeTypeFromStr(type: string): GenericDeviceAttributeModifier {
        if ('ro' === type) {
            return GenericDeviceAttributeModifier.readOnly;
        } else if ('rw' === type) {
            return GenericDeviceAttributeModifier.readWrite;
        } else if ('wo' === type) {
            return GenericDeviceAttributeModifier.writeOnly;
        }

        throw new Error(`Unknown attribute type: ${type}`);
    }

    private createKnownDevice(buttplugDevice: ButtplugClientDevice): KnownButtplugIoDevice {
        if (this.settings.getKnownButtplugIoDevices().has(buttplugDevice.name)) {
            return this.settings.getKnownButtplugIoDevices().get(buttplugDevice.name);
        }

        const knownDevice = new KnownButtplugIoDevice();

        knownDevice.id = this.uuidFactory.create();
        knownDevice.index = buttplugDevice.index;
        knownDevice.name = this.nameGenerator.generateName();
        knownDevice.type = buttplugDevice.name;

        return knownDevice;
    }
}
