import SynchronousSerialPort from "../serial/SynchronousSerialPort.js";
import UuidFactory from "../factory/uuidFactory.js";
import {PortInfo} from "@serialport/bindings-interface/dist/index.js";
import Settings from "../settings/settings.js";
import KnownSerialDevice from "../settings/knownSerialDevice.js";
import Device from "./device.js";
import DeviceNameGenerator from "./deviceNameGenerator.js";
import GenericDevice from "./generic/genericDevice.js";
import GenericDeviceAttribute, {GenericDeviceAttributeModifier} from "./generic/genericDeviceAttribute.js";
import BoolGenericDeviceAttribute from "./generic/boolGenericDeviceAttribute.js";
import FloatGenericDeviceAttribute from "./generic/floatGenericDeviceAttribute.js";
import StrGenericDeviceAttribute from "./generic/strGenericDeviceAttribute.js";
import RangeGenericDeviceAttribute from "./generic/rangeGenericDeviceAttribute.js";
import ListGenericDeviceAttribute from "./generic/listGenericDeviceAttribute.js";

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
        const [deviceType, deviceVersion, protocolVersion] = deviceInfoStr.split(';')[1].split(',');

        const knownDevice = this.createKnownDevice(portInfo.serialNumber, deviceType);

        const deviceAttrResponse = await syncPort.writeLineAndExpect('attributes');
        const deviceAttrs = SerialDeviceFactory.parseDeviceAttributes(deviceAttrResponse);

        const device = new GenericDevice(
            deviceVersion,
            knownDevice.id,
            knownDevice.name,
            deviceType,
            new Date(),
            syncPort,
            portInfo,
            deviceAttrs
        );

        if (null === device) {
            throw new Error('Unknown device type: ' + deviceType);
        }

        this.settings.getKnownSerialDevices().set(portInfo.serialNumber, knownDevice);

        return device;
    }

    private static parseDeviceAttributes(response: string): GenericDeviceAttribute[] {
        // attributes;connected:ro[bool],adc:rw[bool],mode:rw[118-140],levelA:rw[0-99],levelB:rw[0-99]
        const responseParts = response.split(';');
        const attributeList = [];

        if ('attributes' !== responseParts.shift()) {
            throw new Error(`Invalid response format for parsing attributes: ${response}`);
        }



        for (const attr of responseParts.shift().split(',')) {
            const attrParts = attr.split(':');

            attributeList.push(this.createAttributeFromValue(attrParts[0], attrParts[1]));
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
