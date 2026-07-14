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
import DeviceBidirectionalTransport from '../../transport/deviceBidirectionalTransport.js';
import MessageResponseHandler from '../messageResponseHandler.js';
import EventEmitterFactory from '../../../factory/eventEmitterFactory.js';
import { logError } from '../../../util/error.js';
import { DeviceId } from '../../deviceId.js';
import KnownDevice from '../../../settings/knownDevice.js';

export default class Zc95DeviceFactory
{
    private readonly dateFactory: DateFactory;

    private readonly eventEmitterFactory: EventEmitterFactory;

    private readonly settings: Settings;

    private readonly nameGenerator: DeviceNameGenerator;

    private readonly logger: Logger;

    public constructor(
        dateFactory: DateFactory,
        eventEmitterFactory: EventEmitterFactory,
        settings: Settings,
        nameGenerator: DeviceNameGenerator,
        logger: Logger
    ) {
        this.dateFactory = dateFactory;
        this.eventEmitterFactory = eventEmitterFactory;
        this.settings = settings;
        this.nameGenerator = nameGenerator;
        this.logger = logger;
    }

    public async create(
        deviceId: DeviceId,
        versionDetails: VersionMsgResponse,
        protocol: Zc95Protocol,
        transport: DeviceBidirectionalTransport,
        messageFactory: Zc95MessageFactory,
        messageResponseHandler: MessageResponseHandler<Zc95Protocol>,
        provider: string
    ): Promise<Zc95Device> {
        try {
            const availablePatterns = (await messageResponseHandler.send(
                messageFactory.createGetPatterns(),
                2000
            )).Patterns;

            const attributes = this.getAttributes(
                availablePatterns.map((pattern) => ({ key: Int.from(pattern.Id), value: pattern.Name }))
            );

            // We only receive serial no. info for ZC95 devices with fw >=2.0
            const knownDevice = this.createKnownDevice(
                versionDetails.SerialNo !== undefined ? DeviceId.create(versionDetails.SerialNo) : deviceId,
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
                this.settings.addKnownDevice(knownDevice);
            }

            return device;
        } catch (e) {
            logError(this.logger, 'Could not retrieve pattern list', e);
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

    private createKnownDevice(deviceId: DeviceId, provider: string): KnownDevice {
        const knownDevice = this.settings.getKnownDeviceById(deviceId)

        if (undefined !== knownDevice) {
            // Return already existing device if already known (previously detected serial number)
            this.logger.debug(`Device is already known: ${knownDevice.id}`);
            return knownDevice;
        }

        // Create a new device and return if not yet known (new serial number)
        return new KnownDevice(
            deviceId,
            this.nameGenerator.generateName(),
            'zc95',
            provider
        );
    }
}
