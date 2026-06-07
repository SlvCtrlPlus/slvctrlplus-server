import UuidFactory from '../../../factory/uuidFactory.js';
import Settings from '../../../settings/settings.js';
import { ButtplugClientDevice, InputType, OutputType } from 'buttplug';
import ButtplugIoDevice, { ButtplugIoDeviceAttributeKey, ButtplugIoDeviceAttributes } from './buttplugIoDevice.js';
import KnownDevice from '../../../settings/knownDevice.js';
import Logger from '../../../logging/Logger.js';
import { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import IntRangeDeviceAttribute from '../../attribute/intRangeDeviceAttribute.js';
import DateFactory from '../../../factory/dateFactory.js';
import { Int } from '../../../util/numbers.js';
import IntDeviceAttribute from '../../attribute/intDeviceAttribute.js';
import EventEmitterFactory from '../../../factory/eventEmitterFactory.js';


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

        for (const [featureIndex, feature] of buttplugDevice.features) {
            for (const [outputType, output] of feature.outputs) {
                if (outputType === OutputType.Unknown) {
                    continue;
                }

                const attrName: ButtplugIoDeviceAttributeKey = `${outputType}-${featureIndex}`;
                attributes[attrName] = IntRangeDeviceAttribute.createInitialized(
                    attrName,
                    feature.featureDescriptor,
                    DeviceAttributeModifier.readOnly,
                    undefined,
                    Int.from(output.valueRange[0]),
                    Int.from(output.valueRange[1]),
                    Int.from(1),
                    Int.ZERO
                );
            }

            for (const [inputType, input] of feature.inputs) {
                if (inputType === InputType.Unknown) {
                    continue;
                }

                const attrName: ButtplugIoDeviceAttributeKey = `${inputType}-${featureIndex}`;
                attributes[attrName] = IntRangeDeviceAttribute.createInitialized(
                    attrName,
                    feature.featureDescriptor,
                    DeviceAttributeModifier.writeOnly,
                    undefined,
                    Int.from(input.valueRange[0]),
                    Int.from(input.valueRange[1]),
                    Int.from(1),
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
