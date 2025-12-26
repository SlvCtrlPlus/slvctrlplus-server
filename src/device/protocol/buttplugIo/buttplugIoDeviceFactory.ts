import UuidFactory from "../../../factory/uuidFactory.js";
import Settings from "../../../settings/settings.js";
import {ButtplugClientDevice} from "buttplug";
import ButtplugIoDevice, {ButtplugIoDeviceAttributeKey, ButtplugIoDeviceAttributes} from "./buttplugIoDevice.js";
import KnownDevice from "../../../settings/knownDevice.js";
import Logger from "../../../logging/Logger.js";
import {DeviceAttributeModifier} from "../../attribute/deviceAttribute.js";
import IntRangeDeviceAttribute from "../../attribute/intRangeDeviceAttribute.js";
import BoolDeviceAttribute from "../../attribute/boolDeviceAttribute.js";
import DateFactory from "../../../factory/dateFactory.js";
import {Int} from "../../../util/numbers.js";
import IntDeviceAttribute from "../../attribute/intDeviceAttribute.js";


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

    public create(buttplugDevice: ButtplugClientDevice, provider: string, useDeviceNameAsId: boolean): ButtplugIoDevice {
        const knownDevice = this.createKnownDevice(buttplugDevice, provider, useDeviceNameAsId);

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

    private static parseDeviceAttributes(buttplugDevice: ButtplugClientDevice): ButtplugIoDeviceAttributes {
        const attributes = {} as ButtplugIoDeviceAttributes;

        for (const item of buttplugDevice.messageAttributes.ScalarCmd ?? []) {
            const attrName = `${item.ActuatorType}-${item.Index}` as ButtplugIoDeviceAttributeKey;

            if (item.StepCount > 2) {
                attributes[attrName] = IntRangeDeviceAttribute.createInitialized(
                    attrName,
                    item.FeatureDescriptor,
                    DeviceAttributeModifier.writeOnly,
                    undefined,
                    Int.ZERO,
                    Int.from(item.StepCount),
                    Int.from(1),
                    Int.ZERO
                );
            } else {
                attributes[attrName] = BoolDeviceAttribute.createInitialized(
                    attrName, item.FeatureDescriptor, DeviceAttributeModifier.writeOnly, false
                );
            }
        }

        for (const item of buttplugDevice.messageAttributes.SensorReadCmd ?? []) {
            const attrName = `${item.SensorType}-${item.Index}` as ButtplugIoDeviceAttributeKey;

            // A range is defined by two numbers, if there are more or less, let's fallback
            // to a normal integer attribute. Not that dramatic for a sensor after all.
            if (item.StepRange.length === 2) {
                attributes[attrName] = IntRangeDeviceAttribute.createInitialized(
                    `${item.SensorType}-${item.Index}`,
                    item.FeatureDescriptor,
                    DeviceAttributeModifier.readOnly,
                    undefined,
                    Int.from(item.StepRange[0]),
                    Int.from(item.StepRange[1]),
                    Int.from(1),
                    Int.ZERO
                );
            } else {
                attributes[attrName] = IntDeviceAttribute.createInitialized(
                    `${item.SensorType}-${item.Index}`,
                    item.FeatureDescriptor,
                    DeviceAttributeModifier.readOnly,
                    undefined,
                    Int.ZERO
                );
            }
        }

        return attributes;
    }

    private createKnownDevice(buttplugDevice: ButtplugClientDevice, provider: string, useDeviceNameAsId: boolean): KnownDevice {
        // Since we don't get a unique identifier for the Bluetooth device from Intiface,
        // we need to use the index assigned to the device by Intiface. It's the best we have.
        // or the name if using Intiface-engine without id persistence
        const nameString = buttplugDevice.name.replace(/[^a-zA-Z0-9]/g, '');
        const deviceId = useDeviceNameAsId ? `buttplugio-${nameString}` : `buttplugio-${buttplugDevice.index}`;

        const knownDevice = this.settings.getKnownDeviceById(deviceId)

        if (undefined !== knownDevice) {
            // Return already existing device if already known (previously detected serial number)
            this.logger.debug(`Device is already known: ${knownDevice.id} (${deviceId})`);
            return knownDevice;
        }

        return new KnownDevice(
            this.uuidFactory.create(),
            deviceId,
            buttplugDevice.displayName ?? buttplugDevice.name,
            buttplugDevice.name,
            provider
        );
    }
}
