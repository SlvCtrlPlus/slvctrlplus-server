import KnownDeviceRegistry from '../../knownDeviceRegistry.js';
import DateFactory from '../../../factory/dateFactory.js';
import Logger from '../../../logging/Logger.js';
import Zc95Device, { Zc95DeviceAttributes } from './zc95Device.js';
import Zc95MessageFactory, { VersionMsgResponse } from './zc95MessageFactory.js';
import { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import ListDeviceAttribute, { ListDeviceAttributeOptions } from '../../attribute/listDeviceAttribute.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import { Int } from '../../../util/numbers.js';
import Zc95Protocol from './zc95Protocol.js';
import DeviceBidirectionalTransport from '../../transport/deviceBidirectionalTransport.js';
import MessageResponseHandler from '../messageResponseHandler.js';
import EventEmitterFactory from '../../../factory/eventEmitterFactory.js';
import { logError } from '../../../util/error.js';
import { DeviceId, DetectionId } from '../../deviceId.js';

export default class Zc95DeviceFactory
{
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
                2000,
            )).Patterns;

            const attributes = this.getAttributes(
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
                knownDevice.id,
                knownDevice.name,
                provider,
                this.dateFactory.now(),
                versionDetails.ZC95,
                protocol,
                transport,
                true,
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

    private getAttributes(patterns: ListDeviceAttributeOptions<Int, string>): Zc95DeviceAttributes {
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
