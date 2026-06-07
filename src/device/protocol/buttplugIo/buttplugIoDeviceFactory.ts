import UuidFactory from '../../../factory/uuidFactory.js';
import Settings from '../../../settings/settings.js';
import { ButtplugClientDevice, ButtplugClientDeviceFeatureValueRange, InputType, OutputType } from 'buttplug';
import ButtplugIoDevice, { ButtplugIoDeviceAttributeKey, ButtplugIoDeviceAttributes } from './buttplugIoDevice.js';
import KnownDevice from '../../../settings/knownDevice.js';
import Logger from '../../../logging/Logger.js';
import { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import IntRangeDeviceAttribute from '../../attribute/intRangeDeviceAttribute.js';
import DateFactory from '../../../factory/dateFactory.js';
import { Int } from '../../../util/numbers.js';
import EventEmitterFactory from '../../../factory/eventEmitterFactory.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';


export default class ButtplugIoDeviceFactory
{
    private readonly uuidFactory: UuidFactory;

    private readonly dateFactory: DateFactory;

    private readonly settings: Settings;

    private readonly logger: Logger;

    private readonly eventEmitterFactory: EventEmitterFactory;

    public constructor(uuidFactory: UuidFactory, dateFactory: DateFactory, eventEmitterFactory: EventEmitterFactory, settings: Settings, logger: Logger) {
        this.uuidFactory = uuidFactory;
        this.dateFactory = dateFactory;
        this.eventEmitterFactory = eventEmitterFactory;

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
            this.eventEmitterFactory.create(),
        );

        if (null === device) {
            throw new Error('Unknown device type: ' + knownDevice.name);
        }

        this.settings.addKnownDevice(knownDevice);

        return device;
    }

    private static parseDeviceAttributes(buttplugDevice: ButtplugClientDevice): ButtplugIoDeviceAttributes {
        const attributes: ButtplugIoDeviceAttributes = {};

        for (const [, feature] of buttplugDevice.features) {
            for (const [outputType, output] of feature.outputs) {
                if (outputType === OutputType.Unknown) {
                    continue;
                }

                const attrName: ButtplugIoDeviceAttributeKey = `${outputType}-${feature.index}`;

                attributes[attrName] = this.createAttribute(attrName, feature.featureDescriptor, output.valueRange, DeviceAttributeModifier.writeOnly);
            }

            for (const [, input] of feature.inputs) {
                if (input.type === InputType.Unknown) {
                    continue;
                }

                const attrName: ButtplugIoDeviceAttributeKey = `${input.type}-${feature.index}`;

                attributes[attrName] = this.createAttribute(attrName, feature.featureDescriptor, input.valueRange, DeviceAttributeModifier.readOnly);
            }
        }

        return attributes;
    }

    private static createAttribute(
        attrName: ButtplugIoDeviceAttributeKey,
        featureDescriptor: string,
        valueRange: ButtplugClientDeviceFeatureValueRange,
        attributeModifier: DeviceAttributeModifier
    ): IntRangeDeviceAttribute|BoolDeviceAttribute {
        const [valueRangeMin, valueRangeMax] = valueRange;

        if (valueRangeMin === 0 && valueRangeMax === 1) {
            return BoolDeviceAttribute.createInitialized(
                attrName, featureDescriptor, DeviceAttributeModifier.writeOnly, false
            );
        }

        return IntRangeDeviceAttribute.createInitialized(
            attrName,
            featureDescriptor,
            attributeModifier,
            undefined,
            Int.from(valueRangeMin),
            Int.from(valueRangeMax),
            Int.from(1),
            Int.ZERO
        );
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
