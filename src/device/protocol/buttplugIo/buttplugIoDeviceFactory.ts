import type { ButtplugClientDevice } from 'buttplug';
import type { ButtplugIoDeviceAttributeValues } from './buttplugIoDevice.js';
import ButtplugIoDevice from './buttplugIoDevice.js';
import type KnownDeviceRegistry from '../../knownDeviceRegistry.js';
import type KnownDevice from '../../../settings/knownDevice.js';
import type Logger from '../../../logging/Logger.js';
import type DateFactory from '../../../factory/dateFactory.js';
import type EventEmitterFactory from '../../../factory/eventEmitterFactory.js';
import type { DetectionId } from '../../deviceId.js';
import { DeviceId } from '../../deviceId.js';
import buttplugIoAttributesSchema from './buttplugIoAttributesSchema.js';
import type { ButtplugIoDescriptor } from './buttplugIoAttributesSchema.js';
import type JsonSchemaValidatorFactory from '../../../schemaValidation/JsonSchemaValidatorFactory.js';

export default class ButtplugIoDeviceFactory
{
    private static readonly RANGE_BOUNDS_LENGTH = 2;

    private readonly dateFactory: DateFactory;

    private readonly knownDeviceRegistry: KnownDeviceRegistry;

    private readonly validatorFactory: JsonSchemaValidatorFactory;

    private readonly logger: Logger;

    private readonly eventEmitterFactory: EventEmitterFactory;

    public constructor(
        dateFactory: DateFactory,
        eventEmitterFactory: EventEmitterFactory,
        knownDeviceRegistry: KnownDeviceRegistry,
        validatorFactory: JsonSchemaValidatorFactory,
        logger: Logger,
    ) {
        this.dateFactory = dateFactory;
        this.eventEmitterFactory = eventEmitterFactory;
        this.knownDeviceRegistry = knownDeviceRegistry;
        this.validatorFactory = validatorFactory;
        this.logger = logger;
    }

    public create(detectionId: DetectionId, buttplugDevice: ButtplugClientDevice, provider: string): ButtplugIoDevice {
        const knownDevice = this.resolveKnownDevice(DeviceId.fromDetectionId(detectionId), buttplugDevice, provider);

        const { descriptors, attributes, actuatorStepCounts } = ButtplugIoDeviceFactory.parseDevice(buttplugDevice);
        const schema = buttplugIoAttributesSchema(descriptors);

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
            schema,
            attributes,
            this.validatorFactory,
            actuatorStepCounts,
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

    private static parseDevice(buttplugDevice: ButtplugClientDevice): {
        descriptors: ButtplugIoDescriptor[];
        attributes: ButtplugIoDeviceAttributeValues;
        actuatorStepCounts: ReadonlyMap<string, number>;
    } {
        const descriptors: ButtplugIoDescriptor[] = [];
        const attributes: ButtplugIoDeviceAttributeValues = {};
        const actuatorStepCounts = new Map<string, number>();

        for (const item of buttplugDevice.messageAttributes.ScalarCmd ?? []) {
            const key = `${item.ActuatorType}-${item.Index}`;

            if (item.StepCount !== ButtplugIoDeviceFactory.RANGE_BOUNDS_LENGTH) {
                descriptors.push({ key, label: item.FeatureDescriptor, kind: 'range', min: 0, max: item.StepCount });
                attributes[key] = 0;
                actuatorStepCounts.set(key, item.StepCount);
            } else {
                descriptors.push({ key, label: item.FeatureDescriptor, kind: 'bool' });
                attributes[key] = false;
            }
        }

        for (const item of buttplugDevice.messageAttributes.SensorReadCmd ?? []) {
            const key = `${item.SensorType}-${item.Index}`;

            // A range is defined by two numbers, if there are more or less, fall back
            // to a plain integer attribute. Not that dramatic for a sensor after all.
            if ('SensorRange' in item && Array.isArray(item.SensorRange) && item.SensorRange.length === ButtplugIoDeviceFactory.RANGE_BOUNDS_LENGTH) {
                const lowerBound: unknown = item.SensorRange[0];
                const upperBound: unknown = item.SensorRange[1];

                if (typeof lowerBound !== 'number' || typeof upperBound !== 'number') {
                    throw new Error(`Sensor range for sensor type '${item.SensorType}' and index '${item.Index}' is not a valid number range`);
                }

                descriptors.push({ key, label: item.FeatureDescriptor, kind: 'rangeInt', min: lowerBound, max: upperBound });
            } else {
                descriptors.push({ key, label: item.FeatureDescriptor, kind: 'int' });
            }

            attributes[key] = 0;
        }

        return { descriptors, attributes, actuatorStepCounts };
    }
}
