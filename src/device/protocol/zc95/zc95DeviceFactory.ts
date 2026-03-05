import UuidFactory from '../../../factory/uuidFactory.js';
import Settings from '../../../settings/settings.js';
import DeviceNameGenerator from '../../deviceNameGenerator.js';
import DateFactory from '../../../factory/dateFactory.js';
import Logger from '../../../logging/Logger.js';
import Zc95Device, { Zc95DeviceAttributes } from './zc95Device.js';
import Zc95MessageFactory, { VersionMsgResponse } from './zc95MessageFactory.js';
import { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import ListDeviceAttribute, { ListDeviceAttributeOptions } from '../../attribute/listDeviceAttribute.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import { Int } from '../../../util/numbers.js';
import Zc95Protocol from './zc95Protocol.js';
import DeviceTransport from '../../transport/deviceTransport.js';
import MessageResponseHandler from '../messageResponseHandler.js';

export default class Zc95DeviceFactory
{
    private readonly uuidFactory: UuidFactory;

    private readonly dateFactory: DateFactory;

    private readonly settings: Settings;

    private readonly nameGenerator: DeviceNameGenerator;

    private readonly logger: Logger;

    public constructor(
        uuidFactory: UuidFactory,
        dateFactory: DateFactory,
        settings: Settings,
        nameGenerator: DeviceNameGenerator,
        logger: Logger
    ) {
        this.uuidFactory = uuidFactory;
        this.dateFactory = dateFactory;
        this.settings = settings;
        this.nameGenerator = nameGenerator;
        this.logger = logger;
    }

    public async create(
        versionDetails: VersionMsgResponse,
        protocol: Zc95Protocol,
        transport: DeviceTransport,
        messageFactory: Zc95MessageFactory,
        messageResponseHandler: MessageResponseHandler<Zc95Protocol>,
        provider: string
    ): Promise<Zc95Device> {
        try {
            const availablePatterns = (await messageResponseHandler.send(messageFactory.createGetPatterns(), 2000))?.Patterns;

            const attributes = this.getAttributes(
                availablePatterns.map((pattern) => ({ key: Int.from(pattern.Id), value: pattern.Name }))
            );

            // Not relevant until https://github.com/CrashOverride85/zc95/issues/151 is resolved
            // this.settings.addKnownDevice(knownDevice);

            return new Zc95Device(
                this.uuidFactory.create(),
                this.nameGenerator.generateName(),
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
            );
        } catch (e) {
            this.logger.error(`Could not retrieve pattern list: ${(e as Error).message}`, e);
            throw e;
        }
    }

    private getAttributes(patterns: ListDeviceAttributeOptions<Int, string>): Zc95DeviceAttributes {
        const activePatternAttr = ListDeviceAttribute.createInitialized<Int, string>(
            'activePattern', 'Pattern', DeviceAttributeModifier.readWrite, patterns, Int.ZERO
        );

        const patternStartedAttr = BoolDeviceAttribute.createInitialized(
            'patternStarted', 'Pattern Started', DeviceAttributeModifier.readWrite, false
        );

        return {
            activePattern: activePatternAttr,
            patternStarted: patternStartedAttr,
        };
    }
}
