import { ReadlineParser, ReadyParser } from 'serialport';
import { SerialPortStream } from '@serialport/stream';
import { BindingInterface, PortInfo } from '@serialport/bindings-interface';
import BaseError from 'modern-errors';
import GenericSlvCtrlPlusDevice from './genericSlvCtrlPlusDevice.js';
import DateFactory from '../../../factory/dateFactory.js';
import DeviceBidirectionalTransport from '../../transport/deviceBidirectionalTransport.js';
import SlvCtrlProtocolLegacy from './slvCtrlProtocolLegacy.js';
import Logger from '../../../logging/Logger.js';
import SlvCtrlProtocolV1 from './slvCtrlProtocolV1.js';
import SlvCtrlProtocol, { DeviceInfo } from './slvCtrlProtocol.js';
import { getErrorFromDecodeResult } from '../deviceProtocol.js';
import EventEmitterFactory from '../../../factory/eventEmitterFactory.js';
import { SlvCtrlPlusDeviceAttributes } from './slvCtrlPlusDevice.js';
import { DeviceId } from '../../deviceId.js';
import KnownDeviceResolver from '../../knownDeviceResolver.js';
import SynchronousSerialPort from '../../../serial/synchronousSerialPort.js';
import SerialDeviceTransportFactory from '../../transport/serialDeviceTransportFactory.js';
import SerialProtocolFactory, { SerialDeviceInfo, SerialDeviceProviderPortOpenOptions } from '../../provider/serialProtocolFactory.js';

export default class SlvCtrlPlusDeviceFactory implements SerialProtocolFactory<GenericSlvCtrlPlusDevice>
{
    public static readonly protocolName = 'slvCtrlPlusSerial';

    public readonly protocolName = SlvCtrlPlusDeviceFactory.protocolName;

    private static readonly moduleReadyByte = 0x07;

    private static readonly arduinoVendorId = '2341';

    private readonly dateFactory: DateFactory;

    protected readonly eventEmitterFactory: EventEmitterFactory;

    private readonly knownDeviceResolver: KnownDeviceResolver;

    private readonly deviceTransportFactory: SerialDeviceTransportFactory;

    private readonly logger: Logger;

    public constructor(
        dateFactory: DateFactory,
        eventEmitterFactory: EventEmitterFactory,
        knownDeviceResolver: KnownDeviceResolver,
        deviceTransportFactory: SerialDeviceTransportFactory,
        logger: Logger
    ) {
        this.dateFactory = dateFactory;
        this.eventEmitterFactory = eventEmitterFactory;
        this.knownDeviceResolver = knownDeviceResolver;
        this.deviceTransportFactory = deviceTransportFactory;
        this.logger = logger.child({ name: SlvCtrlPlusDeviceFactory.name });
    }

    public getPortOpenOptions(): SerialDeviceProviderPortOpenOptions {
        return { baudRate: 9600 };
    }

    public preparePort(port: SerialPortStream<BindingInterface>, portInfo: PortInfo): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (portInfo.vendorId !== SlvCtrlPlusDeviceFactory.arduinoVendorId) {
                // It's NOT an Arduino
                resolve();
                return;
            }

            const readyParser = port.pipe(new ReadyParser({
                delimiter: [SlvCtrlPlusDeviceFactory.moduleReadyByte]
            }));

            // Let's timeout if we don't receive the ready bytes for a few seconds
            const timeout = setTimeout(() => {
                port.unpipe(readyParser);
                readyParser.destroy();
                reject(new Error(`Timed out while waiting for ready bytes`));
            }, 3000);

            readyParser.once('ready', () => {
                clearTimeout(timeout);
                port.unpipe(readyParser);
                readyParser.destroy();
                resolve();
            });
        });
    }

    public async tryConnect(deviceInfo: SerialDeviceInfo, port: SerialPortStream<BindingInterface>): Promise<GenericSlvCtrlPlusDevice | undefined> {
        const parser = port.pipe(new ReadlineParser({ delimiter: SlvCtrlProtocol.EOF }));
        const syncPort = new SynchronousSerialPort(deviceInfo.portInfo, parser, port, this.logger);
        const transport = this.deviceTransportFactory.create(syncPort, undefined, Buffer.from(SlvCtrlProtocol.EOF));

        await this.performHandshakeWithRetries(transport, 4);

        const device = await this.create(deviceInfo.id, transport, SlvCtrlPlusDeviceFactory.protocolName);

        this.logger.info(`Module detected: ${device.getDeviceModel} (${deviceInfo.portInfo.serialNumber})`);

        return device;
    }

    private async performHandshakeWithRetries(transport: DeviceBidirectionalTransport, maxAttempts: number): Promise<void> {
        let lastError;

        for (let i = 1; i <= maxAttempts; i++) {
            try {
                await transport.sendAndAwaitReceive(Buffer.from(`clear`), 250);
                return;
            } catch(e: unknown) {
                const error = BaseError.normalize(e);
                this.logger.info(`Retrying because handshake attempt ${i} failed: ${error.message}`);
                if (i === maxAttempts) lastError = e;
            }
        }

        throw lastError;
    }

    public async create(deviceId: DeviceId, transport: DeviceBidirectionalTransport, provider: string): Promise<GenericSlvCtrlPlusDevice> {
        const deviceInfo = await this.getDeviceInfo(transport);
        const protocol = deviceInfo.protocol;
        const knownDevice = this.knownDeviceResolver.resolveOrCreate(deviceId, deviceInfo.deviceType, provider);
        const deviceAttributes = await this.getAttributes(transport, protocol);

        return new GenericSlvCtrlPlusDevice(
            deviceInfo.fwVersion,
            knownDevice.id,
            knownDevice.name,
            deviceInfo.deviceType,
            provider,
            this.dateFactory.now(),
            protocol,
            transport,
            deviceInfo.protocolVersion,
            deviceAttributes,
            this.eventEmitterFactory.create(),
            this.logger,
        );
    }

    private async getDeviceInfo(transport: DeviceBidirectionalTransport): Promise<DeviceInfo & { protocol: SlvCtrlProtocol }>
    {
        const infoResponse = await transport.sendAndAwaitReceive(
            Buffer.from(`introduce`),
            SlvCtrlProtocol.transportTimeoutMs,
        );
        const protocol = this.getProtocol(infoResponse.toString('utf-8'));
        const decodedInfoResponse = protocol.decode(infoResponse);

        if ('error' in decodedInfoResponse) {
            throw getErrorFromDecodeResult(decodedInfoResponse.error, infoResponse);
        }

        if (decodedInfoResponse.message.result.status !== 'ok') {
            const reason = decodedInfoResponse.message.result.reason ?? 'unknown';
            throw new Error(`Could not retrieve device information: ${reason}`)
        }

        const deviceInfo = decodedInfoResponse.message.data;

        const fwVersion = Number.parseInt(deviceInfo.fw, 10);
        const protocolVersion = Number.parseInt(deviceInfo.protocol, 10);

        if (Number.isNaN(fwVersion) || Number.isNaN(protocolVersion)) {
            throw new Error(
                `Invalid version payload: fw='${deviceInfo.fw}', protocol='${deviceInfo.protocol}'`
            );
        }

        return { fwVersion, protocolVersion, deviceType: deviceInfo.type, protocol };
    }

    private async getAttributes(transport: DeviceBidirectionalTransport, protocol: SlvCtrlProtocol): Promise<SlvCtrlPlusDeviceAttributes>
    {
        const attrResponse = await transport.sendAndAwaitReceive(
            protocol.encode({ command: 'attributes', args: [] }),
            SlvCtrlProtocol.transportTimeoutMs,
        );
        const decodedAttrResponse = protocol.decode(attrResponse);

        if ('error' in decodedAttrResponse) {
            throw getErrorFromDecodeResult(decodedAttrResponse.error, attrResponse);
        }

        if (decodedAttrResponse.message.result.status !== 'ok') {
            const reason = decodedAttrResponse.message.result.reason ?? 'unknown';
            throw new Error(`Could not retrieve device attributes: ${reason}`)
        }

        return protocol.getAttributes(decodedAttrResponse.message.data);
    }

    private getProtocol(introductionResult: string): SlvCtrlProtocol {
        if (/^introduce;([^,;]+),(\d+),(\d+)$/.test(introductionResult)) {
            this.logger.info('SlvCtrl protocol <V1 detected');
            return new SlvCtrlProtocolLegacy();
        }

        return new SlvCtrlProtocolV1();
    }
}
