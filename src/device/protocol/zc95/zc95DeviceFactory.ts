import { SerialPortStream } from '@serialport/stream';
import { BindingInterface } from '@serialport/bindings-interface';
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
import SynchronousSerialPort from '../../../serial/synchronousSerialPort.js';
import { FrameParser } from '../../../serial/frameParser.js';
import SerialDeviceTransportFactory from '../../transport/serialDeviceTransportFactory.js';
import SerialProtocolFactory, { SerialDeviceInfo, SerialDeviceProviderPortOpenOptions } from '../../provider/serialProtocolFactory.js';

export default class Zc95DeviceFactory implements SerialProtocolFactory<Zc95Device>
{
    public static readonly protocolName = 'zc95Serial';

    public readonly protocolName = Zc95DeviceFactory.protocolName;

    private readonly dateFactory: DateFactory;

    private readonly eventEmitterFactory: EventEmitterFactory;

    private readonly settings: Settings;

    private readonly nameGenerator: DeviceNameGenerator;

    private readonly transportFactory: SerialDeviceTransportFactory;

    private readonly logger: Logger;

    public constructor(
        dateFactory: DateFactory,
        eventEmitterFactory: EventEmitterFactory,
        settings: Settings,
        nameGenerator: DeviceNameGenerator,
        transportFactory: SerialDeviceTransportFactory,
        logger: Logger
    ) {
        this.dateFactory = dateFactory;
        this.eventEmitterFactory = eventEmitterFactory;
        this.settings = settings;
        this.nameGenerator = nameGenerator;
        this.transportFactory = transportFactory;
        this.logger = logger;
    }

    public getPortOpenOptions(): SerialDeviceProviderPortOpenOptions {
        return { baudRate: 115200 };
    }

    public async tryConnect(deviceInfo: SerialDeviceInfo, port: SerialPortStream<BindingInterface>): Promise<Zc95Device | undefined> {
        const serialLogger = this.logger.child({ name: Zc95Device.name })

        const parser = port.pipe(new FrameParser({ stx: Zc95Protocol.STX, etx: Zc95Protocol.ETX }));
        const serialPort = new SynchronousSerialPort(deviceInfo.portInfo, parser, port, serialLogger);
        const transport = this.transportFactory.create(
            serialPort, Buffer.from([Zc95Protocol.STX]), Buffer.from([Zc95Protocol.ETX])
        );
        const protocol = new Zc95Protocol();
        const messageFactory = new Zc95MessageFactory();

        const messageResponseHandler = MessageResponseHandler.create(
            protocol,
            transport,
            this.logger,
        );

        this.logger.debug(`Reset device connection`);
        await this.reset(port, false);
        const versionDetails = await messageResponseHandler.send(messageFactory.createGetVersionDetails());

        this.logger.info(`Module detected: ZC95 ${versionDetails.ZC95} (${deviceInfo.portInfo.serialNumber})`);

        return this.create(
            deviceInfo.id,
            versionDetails,
            protocol,
            transport,
            messageFactory,
            messageResponseHandler,
            Zc95DeviceFactory.protocolName
        );
    }

    private async reset(port: SerialPortStream<BindingInterface>, close: boolean = false): Promise<void> {
        return new Promise((resolve, reject) => {
            port.write(Buffer.from([Zc95Protocol.EOT]), (writeErr: Error | null | undefined) => {
                if (null != writeErr) {
                    reject(writeErr);
                    return;
                }

                this.logger.trace('> EOT');

                if (close) {
                    port.close((closeErr: Error | null) => {
                        if (null != closeErr) {
                            reject(closeErr);
                            return;
                        }
                        setTimeout(resolve, 250);
                    });
                } else {
                    setTimeout(resolve, 250);
                }
            });
        });
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

            // Not relevant until https://github.com/CrashOverride85/zc95/issues/151 is resolved
            // this.settings.addKnownDevice(knownDevice);

            return new Zc95Device(
                deviceId,
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
                this.eventEmitterFactory.create(),
                this.logger,
            );
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
}
