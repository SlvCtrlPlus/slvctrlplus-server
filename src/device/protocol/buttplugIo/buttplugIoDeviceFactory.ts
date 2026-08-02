import { ButtplugClientDevice } from 'buttplug';
import ButtplugIoDevice, { ButtplugIoDeviceAttributeKey, ButtplugIoDeviceAttributes } from './buttplugIoDevice.js';
import KnownDeviceRegistry from '../../knownDeviceRegistry.js';
import KnownDevice from '../../../settings/knownDevice.js';
import Logger from '../../../logging/Logger.js';
import { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import IntRangeDeviceAttribute from '../../attribute/intRangeDeviceAttribute.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import DateFactory from '../../../factory/dateFactory.js';
import { Int } from '../../../util/numbers.js';
import IntDeviceAttribute from '../../attribute/intDeviceAttribute.js';
import EventEmitterFactory from '../../../factory/eventEmitterFactory.js';
import { DeviceId, DetectionId } from '../../deviceId.js';


export default class ButtplugIoDeviceFactory
{
    private readonly dateFactory: DateFactory;

    private readonly knownDeviceRegistry: KnownDeviceRegistry;

    private readonly logger: Logger;

    private readonly eventEmitterFactory: EventEmitterFactory;

    public constructor(
        dateFactory: DateFactory,
        eventEmitterFactory: EventEmitterFactory,
        knownDeviceRegistry: KnownDeviceRegistry,
        logger: Logger
    ) {
        this.dateFactory = dateFactory;
        this.eventEmitterFactory = eventEmitterFactory;

        this.knownDeviceRegistry = knownDeviceRegistry;
        this.logger = logger;
    }

    public create(detectionId: DetectionId, buttplugDevice: ButtplugClientDevice, provider: string): ButtplugIoDevice {
        const knownDevice = this.resolveKnownDevice(DeviceId.fromDetectionId(detectionId), buttplugDevice, provider);

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
            this.logger,
        );

        if (null === device) {
            throw new Error('Unknown device type: ' + knownDevice.name);
        }

        this.knownDeviceRegistry.persist(knownDevice);

        return device;
    }

    private static parseDeviceAttributes(buttplugDevice: ButtplugClientDevice): ButtplugIoDeviceAttributes {
        const attributes: ButtplugIoDeviceAttributes = {};

        for (const item of buttplugDevice.messageAttributes.ScalarCmd ?? []) {
            const attrName: ButtplugIoDeviceAttributeKey = `${item.ActuatorType}-${item.Index}`;

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
            const attrName: ButtplugIoDeviceAttributeKey = `${item.SensorType}-${item.Index}`;

            // A range is defined by two numbers, if there are more or less, let's fallback
            // to a normal integer attribute. Not that dramatic for a sensor after all.
            if ('SensorRange' in item && Array.isArray(item.SensorRange) && item.SensorRange.length === 2) {
                attributes[attrName] = IntRangeDeviceAttribute.createInitialized(
                    `${item.SensorType}-${item.Index}`,
                    item.FeatureDescriptor,
                    DeviceAttributeModifier.readOnly,
                    undefined,
                    Int.from(item.SensorRange[0]),
                    Int.from(item.SensorRange[1]),
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

    private resolveKnownDevice(deviceId: DeviceId, buttplugDevice: ButtplugClientDevice, provider: string): KnownDevice {
        return this.knownDeviceRegistry.resolve(
            deviceId,
            buttplugDevice.name,
            provider,
            buttplugDevice.displayName ?? buttplugDevice.name,
        );
    }
}
