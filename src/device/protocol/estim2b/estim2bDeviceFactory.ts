import type KnownDeviceRegistry from '../../knownDeviceRegistry.js';
import type DateFactory from '../../../factory/dateFactory.js';
import type Logger from '../../../logging/Logger.js';
import type { EStim2bStatus } from './estim2bProtocol.js';
import type EStim2bProtocol from './estim2bProtocol.js';
import EStim2bDevice from './estim2bDevice.js';
import type DeviceBidirectionalTransport from '../../transport/deviceBidirectionalTransport.js';
import type EventEmitterFactory from '../../../factory/eventEmitterFactory.js';
import type JsonSchemaValidatorFactory from '../../../schemaValidation/JsonSchemaValidatorFactory.js';
import type { DetectionId } from '../../deviceId.js';
import { DeviceId } from '../../deviceId.js';
import { estim2bAttributesSchema, getPulseConfigForMode } from './estim2bAttributesSchema.js';
import type { EStim2bAttributeValues } from './estim2bAttributesSchema.js';

export default class Estim2bDeviceFactory
{
    private readonly dateFactory: DateFactory;

    private readonly knownDeviceRegistry: KnownDeviceRegistry;

    private readonly logger: Logger;

    private readonly eventEmitterFactory: EventEmitterFactory;

    private readonly jsonSchemaValidatorFactory: JsonSchemaValidatorFactory;

    public constructor(
        dateFactory: DateFactory,
        eventEmitterFactory: EventEmitterFactory,
        knownDeviceRegistry: KnownDeviceRegistry,
        jsonSchemaValidatorFactory: JsonSchemaValidatorFactory,
        logger: Logger,
    ) {
        this.dateFactory = dateFactory;
        this.eventEmitterFactory = eventEmitterFactory;
        this.knownDeviceRegistry = knownDeviceRegistry;
        this.jsonSchemaValidatorFactory = jsonSchemaValidatorFactory;
        this.logger = logger;
    }

    public create(
        detectionId: DetectionId,
        protocol: EStim2bProtocol,
        transport: DeviceBidirectionalTransport,
        initialStatus: EStim2bStatus,
        provider: string,
    ): EStim2bDevice {
        const knownDevice = this.knownDeviceRegistry.resolve(DeviceId.fromDetectionId(detectionId), 'estim2b', provider);
        const pulseConfig = getPulseConfigForMode(initialStatus.currentMode);
        const schema = estim2bAttributesSchema(pulseConfig);

        const attributes: EStim2bAttributeValues = {
            mode: initialStatus.currentMode,
            channelALevel: Math.round(initialStatus.channelALevel),
            channelBLevel: Math.round(initialStatus.channelBLevel),
            channelsJoined: initialStatus.channelsJoined,
            highPowerMode: initialStatus.powerMode === 'H',
            batteryStatus: EStim2bDevice.humanReadableBatteryLevel(initialStatus.batteryLevel),
            ...(pulseConfig !== undefined
                ? {
                    pulseFrequency: Math.round(initialStatus.pulseFrequency),
                    ...(pulseConfig.pulsePwmLabel !== undefined
                        ? { pulsePwm: Math.round(initialStatus.pulsePwm) }
                        : {}),
                }
                : {}),
        };

        const device = new EStim2bDevice(
            {
                deviceId: knownDevice.id,
                deviceName: knownDevice.name,
                provider: provider,
                connectedSince: this.dateFactory.now(),
                controllable: true,
            },
            initialStatus,
            protocol,
            transport,
            schema,
            attributes,
            this.jsonSchemaValidatorFactory,
            this.eventEmitterFactory.create(),
            this.logger,
        );

        this.knownDeviceRegistry.persist(knownDevice);

        return device;
    }
}
