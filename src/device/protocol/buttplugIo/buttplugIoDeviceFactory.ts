import type { ButtplugClientDevice } from 'buttplug';
import type { ButtplugIoDeviceAttributeKey, ButtplugIoDeviceAttributes } from './buttplugIoDevice.js';
import ButtplugIoDevice from './buttplugIoDevice.js';
import type KnownDeviceRegistry from '../../knownDeviceRegistry.js';
import type KnownDevice from '../../../settings/knownDevice.js';
import type Logger from '../../../logging/Logger.js';
import { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import IntRangeDeviceAttribute from '../../attribute/intRangeDeviceAttribute.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import type DateFactory from '../../../factory/dateFactory.js';
import { Int } from '../../../util/numbers.js';
import IntDeviceAttribute from '../../attribute/intDeviceAttribute.js';
import type EventEmitterFactory from '../../../factory/eventEmitterFactory.js';
import type { DetectionId } from '../../deviceId.js';
import { DeviceId } from '../../deviceId.js';

export default class ButtplugIoDeviceFactory
{
    private static readonly RANGE_BOUNDS_LENGTH = 2;

    private readonly dateFactory: DateFactory;

    private readonly knownDeviceRegistry: KnownDeviceRegistry;

    private readonly logger: Logger;

    private readonly eventEmitterFactory: EventEmitterFactory;

    public constructor(
        dateFactory: DateFactory,
        eventEmitterFactory: EventEmitterFactory,
        knownDeviceRegistry: KnownDeviceRegistry,
        logger: Logger,
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
            {
                deviceId: knownDevice.id,
                deviceName: knownDevice.name,
                provider,
                connectedSince: this.dateFactory.now(),
                controllable: true,
            },
            buttplugDevice.name,
            buttplugDevice,
            deviceAttrs,
            this.eventEmitterFactory.create(),
            this.logger,
        );

        this.knownDeviceRegistry.persist(knownDevice);

        return device;
    }

    private resolveKnownDevice(deviceId: DeviceId, buttplugDevice: ButtplugClientDevice, provider: string): KnownDevice {
        return this.knownDeviceRegistry.resolve(
            deviceId,
            buttplugDevice.name,
            provider,
            buttplugDevice.displayName ?? buttplugDevice.name,
        );
    }

    private static parseDeviceAttributes(buttplugDevice: ButtplugClientDevice): ButtplugIoDeviceAttributes {
        const attributes: ButtplugIoDeviceAttributes = {};

        for (const item of buttplugDevice.messageAttributes.ScalarCmd ?? []) {
            const attrName: ButtplugIoDeviceAttributeKey = `${item.ActuatorType}-${item.Index}`;

            if (item.StepCount !== ButtplugIoDeviceFactory.RANGE_BOUNDS_LENGTH) {
                attributes[attrName] = IntRangeDeviceAttribute.createInitialized(
                    attrName,
                    item.FeatureDescriptor,
                    DeviceAttributeModifier.writeOnly,
                    undefined,
                    Int.ZERO,
                    Int.from(item.StepCount),
                    Int.from(1),
                    Int.ZERO,
                );
            } else {
                attributes[attrName] = BoolDeviceAttribute.createInitialized(
                    attrName, item.FeatureDescriptor, DeviceAttributeModifier.writeOnly, false,
                );
            }
        }

        for (const item of buttplugDevice.messageAttributes.SensorReadCmd ?? []) {
            const attrName: ButtplugIoDeviceAttributeKey = `${item.SensorType}-${item.Index}`;

            // A range is defined by two numbers, if there are more or less, let's fallback
            // to a normal integer attribute. Not that dramatic for a sensor after all.
            if ('SensorRange' in item && Array.isArray(item.SensorRange) && item.SensorRange.length === ButtplugIoDeviceFactory.RANGE_BOUNDS_LENGTH) {
                const lowerBound: unknown = item.SensorRange[0];
                const upperBound: unknown = item.SensorRange[1];

                if (typeof lowerBound !== 'number' || typeof upperBound !== 'number') {
                    throw new Error(`Sensor range for sensor type '${item.SensorType}' and index '${item.Index}' is not a valid number range`);
                }

                attributes[attrName] = IntRangeDeviceAttribute.createInitialized(
                    `${item.SensorType}-${item.Index}`,
                    item.FeatureDescriptor,
                    DeviceAttributeModifier.readOnly,
                    undefined,
                    Int.from(lowerBound),
                    Int.from(upperBound),
                    Int.from(1),
                    Int.ZERO,
                );
            } else {
                attributes[attrName] = IntDeviceAttribute.createInitialized(
                    `${item.SensorType}-${item.Index}`,
                    item.FeatureDescriptor,
                    DeviceAttributeModifier.readOnly,
                    undefined,
                    Int.ZERO,
                );
            }
        }

        return attributes;
    }
}
