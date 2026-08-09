import type KnownDeviceRegistry from '../../knownDeviceRegistry.js';
import type DateFactory from '../../../factory/dateFactory.js';
import type Logger from '../../../logging/Logger.js';
import type { Zc95DeviceAttributes } from './zc95Device.js';
import Zc95Device from './zc95Device.js';
import type { VersionMsgResponse } from './zc95MessageFactory.js';
import type Zc95MessageFactory from './zc95MessageFactory.js';
import { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import type { ListDeviceAttributeOptions } from '../../attribute/listDeviceAttribute.js';
import ListDeviceAttribute from '../../attribute/listDeviceAttribute.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import { Int } from '../../../util/numbers.js';
import type Zc95Protocol from './zc95Protocol.js';
import type DeviceBidirectionalTransport from '../../transport/deviceBidirectionalTransport.js';
import type MessageResponseHandler from '../messageResponseHandler.js';
import type EventEmitterFactory from '../../../factory/eventEmitterFactory.js';
import { logError } from '../../../util/error.js';
import type { DetectionId } from '../../deviceId.js';
import { DeviceId } from '../../deviceId.js';

export default class Zc95DeviceFactory
{
    private static readonly PATTERN_LIST_RESPONSE_TIMEOUT_MS = 2000;

    private readonly dateFactory: DateFactory;

    private readonly eventEmitterFactory: EventEmitterFactory;

    private readonly knownDeviceRegistry: KnownDeviceRegistry;

    private readonly logger: Logger;

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

    public async create(
        detectionId: DetectionId,
        versionDetails: VersionMsgResponse,
        protocol: Zc95Protocol,
        transport: DeviceBidirectionalTransport,
        messageFactory: Zc95MessageFactory,
        messageResponseHandler: MessageResponseHandler<Zc95Protocol>,
        provider: string,
    ): Promise<Zc95Device> {
        try {
            const availablePatterns = (await messageResponseHandler.send(
                messageFactory.createGetPatterns(),
                Zc95DeviceFactory.PATTERN_LIST_RESPONSE_TIMEOUT_MS,
            )).Patterns;

            const attributes = Zc95DeviceFactory.getAttributes(
                availablePatterns.map(pattern => ({ key: Int.from(pattern.Id), value: pattern.Name })),
            );

            // We only receive serial no. info for ZC95 devices with fw >=2.0
            const knownDevice = this.knownDeviceRegistry.resolve(
                versionDetails.SerialNo !== undefined
                    ? DeviceId.create(versionDetails.SerialNo)
                    : DeviceId.fromDetectionId(detectionId),
                'zc95',
                provider,
            );

            const device = new Zc95Device(
                {
                    deviceId: knownDevice.id,
                    deviceName: knownDevice.name,
                    provider,
                    connectedSince: this.dateFactory.now(),
                    controllable: true,
                },
                versionDetails.ZC95,
                protocol,
                transport,
                attributes,
                {},
                messageFactory,
                messageResponseHandler,
                this.eventEmitterFactory.create(),
                this.logger,
            );

            // Only store the known device if we have a deterministic device id based on serial no. info of the zc95 fw
            if (versionDetails.SerialNo !== undefined) {
                this.knownDeviceRegistry.persist(knownDevice);
            }

            return device;
        } catch (e) {
            logError(this.logger, 'Could not retrieve pattern list', e);
            throw e;
        }
    }

    private static getAttributes(patterns: ListDeviceAttributeOptions<Int, string>): Zc95DeviceAttributes {
        const activePatternAttr = ListDeviceAttribute.createInitialized<Int, string>(
            'activePattern', 'Pattern', DeviceAttributeModifier.readWrite, patterns, Int.ZERO,
        );

        const patternStartedAttr = BoolDeviceAttribute.createInitialized(
            'patternStarted', 'Pattern Started', DeviceAttributeModifier.readWrite, false,
        );

        return {
            activePattern: activePatternAttr,
            patternStarted: patternStartedAttr,
        };
    }
}
