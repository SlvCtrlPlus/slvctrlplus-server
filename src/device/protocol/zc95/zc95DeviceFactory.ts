import type KnownDeviceRegistry from '../../knownDeviceRegistry.js';
import type DateFactory from '../../../factory/dateFactory.js';
import type Logger from '../../../logging/Logger.js';
import type { Zc95AttributeValues } from './zc95Device.js';
import Zc95Device from './zc95Device.js';
import type { PatternsMsgResponse, VersionMsgResponse } from './zc95MessageFactory.js';
import type Zc95MessageFactory from './zc95MessageFactory.js';
import type Zc95Protocol from './zc95Protocol.js';
import type DeviceBidirectionalTransport from '../../transport/deviceBidirectionalTransport.js';
import type MessageResponseHandler from '../messageResponseHandler.js';
import type EventEmitterFactory from '../../../factory/eventEmitterFactory.js';
import { logError } from '../../../util/error.js';
import type { DetectionId } from '../../deviceId.js';
import { DeviceId } from '../../deviceId.js';
import { zc95AttributesSchema } from './zc95AttributesSchema.js';

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

            const { schema, attributes } = Zc95DeviceFactory.buildInitialAttributes(availablePatterns);

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
                schema,
                attributes,
                availablePatterns,
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

    private static buildInitialAttributes(
        patterns: PatternsMsgResponse['Patterns'],
    ): { schema: ReturnType<typeof zc95AttributesSchema>, attributes: Zc95AttributeValues } {
        const schema = zc95AttributesSchema({
            patterns,
            activePatternMenuItems: [],
            powerChannels: [],
        });

        const attributes: Zc95AttributeValues = {
            activePattern: 0,
            patternStarted: false,
        };

        return { schema, attributes };
    }
}
