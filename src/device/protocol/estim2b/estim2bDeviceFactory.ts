import UuidFactory from '../../../factory/uuidFactory.js';
import Settings from '../../../settings/settings.js';
import DeviceNameGenerator from '../../deviceNameGenerator.js';
import DateFactory from '../../../factory/dateFactory.js';
import Logger from '../../../logging/Logger.js';
import Zc95Device, { Zc95DeviceAttributes } from './zc95Device.js';
import { MsgResponse, VersionMsgResponse, Zc95Messages } from './Zc95Messages.js';
import { DeviceAttributeModifier } from '../../attribute/deviceAttribute.js';
import ListDeviceAttribute from '../../attribute/listDeviceAttribute.js';
import BoolDeviceAttribute from '../../attribute/boolDeviceAttribute.js';
import { Int } from '../../../util/numbers.js';
import EStim2bProtocol from './estim2bProtocol.js';

export default class Estim2bDeviceFactory
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
        transport: EStim2bProtocol,
        receiveQueue: MsgResponse[],
        provider: string
    ): Promise<Zc95Device> {
        const availablePatterns = (await transport.getPatterns()).Patterns;

        const attributes = this.getAttributes(new Map(
            availablePatterns.map((pattern) => [Int.from(pattern.Id), pattern.Name])
        ));

        // Not relevant until https://github.com/CrashOverride85/zc95/issues/151 is resolved
        // this.settings.addKnownDevice(knownDevice);

        return new Zc95Device(
            this.uuidFactory.create(),
            this.nameGenerator.generateName(),
            provider,
            this.dateFactory.now(),
            versionDetails.ZC95,
            transport,
            true,
            attributes,
            {},
            receiveQueue
        );
    }

    private getAttributes(patterns: Map<Int, string>): Zc95DeviceAttributes {
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
