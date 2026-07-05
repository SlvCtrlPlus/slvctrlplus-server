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

export default class SlvCtrlPlusDeviceFactory
{
    private readonly dateFactory: DateFactory;

    protected readonly eventEmitterFactory: EventEmitterFactory;

    private readonly knownDeviceResolver: KnownDeviceResolver;

    private readonly logger: Logger;

    public constructor(
        dateFactory: DateFactory,
        eventEmitterFactory: EventEmitterFactory,
        knownDeviceResolver: KnownDeviceResolver,
        logger: Logger
    ) {
        this.dateFactory = dateFactory;
        this.eventEmitterFactory = eventEmitterFactory;
        this.knownDeviceResolver = knownDeviceResolver;
        this.logger = logger.child({ name: SlvCtrlPlusDeviceFactory.name });
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
