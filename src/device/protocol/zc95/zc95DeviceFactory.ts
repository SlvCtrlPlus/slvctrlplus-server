import UuidFactory from "../../../factory/uuidFactory.js";
import Settings from "../../../settings/settings.js";
import DeviceNameGenerator from "../../deviceNameGenerator.js";
import DateFactory from "../../../factory/dateFactory.js";
import Logger from "../../../logging/Logger.js";
import Zc95Device from "./zc95Device.js";
import {MsgResponse, VersionMsgResponse, Zc95Messages} from "./Zc95Messages.js";
import GenericDeviceAttribute, {GenericDeviceAttributeModifier} from "../../attribute/genericDeviceAttribute.js";
import ListGenericDeviceAttribute from "../../attribute/listGenericDeviceAttribute.js";
import RangeGenericDeviceAttribute from "../../attribute/rangeGenericDeviceAttribute.js";
import BoolGenericDeviceAttribute from "../../attribute/boolGenericDeviceAttribute.js";

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
        transport: Zc95Messages,
        receiveQueue: MsgResponse[],
        provider: string
    ): Promise<Zc95Device> {
        const availablePatterns = (await transport.getPatterns()).Patterns;

        const attributes = this.getAttributes(new Map(
            availablePatterns.map((pattern) => [pattern.Id, pattern.Name])
        ));

        // Not relevant until https://github.com/CrashOverride85/zc95/issues/151 is resolved
        // this.settings.addKnownDevice(knownDevice);

        return new Zc95Device(
            this.uuidFactory.create(),
            this.nameGenerator.generateName(),
            provider,
            this.dateFactory.now(),
            transport,
            true,
            attributes,
            receiveQueue
        );
    }

    private getAttributes(patterns: Map<number, string>): GenericDeviceAttribute[] {
        const activePatternAttr = new ListGenericDeviceAttribute();
        activePatternAttr.name = 'activePattern';
        activePatternAttr.label = 'Pattern';
        activePatternAttr.values = patterns;
        activePatternAttr.modifier = GenericDeviceAttributeModifier.readWrite;

        const patternStartedAttr = new BoolGenericDeviceAttribute();
        patternStartedAttr.name = 'patternStarted';
        patternStartedAttr.label = 'Pattern Started';
        patternStartedAttr.modifier = GenericDeviceAttributeModifier.readWrite;

        return [activePatternAttr, patternStartedAttr];
    }
}
