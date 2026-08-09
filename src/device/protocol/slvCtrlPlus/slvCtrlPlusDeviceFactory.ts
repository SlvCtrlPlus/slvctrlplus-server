import type KnownDeviceRegistry from '../../knownDeviceRegistry.js';
import GenericSlvCtrlPlusDevice from './genericSlvCtrlPlusDevice.js';
import type DateFactory from '../../../factory/dateFactory.js';
import type DeviceBidirectionalTransport from '../../transport/deviceBidirectionalTransport.js';
import SlvCtrlProtocolLegacy from './slvCtrlProtocolLegacy.js';
import type Logger from '../../../logging/Logger.js';
import SlvCtrlProtocolV1 from './slvCtrlProtocolV1.js';
import type { DeviceInfo } from './slvCtrlProtocol.js';
import SlvCtrlProtocol from './slvCtrlProtocol.js';
import { getErrorFromDecodeResult } from '../deviceProtocol.js';
import type EventEmitterFactory from '../../../factory/eventEmitterFactory.js';
import type { SlvCtrlPlusDeviceAttributes } from './slvCtrlPlusDevice.js';
import type { DetectionId } from '../../deviceId.js';
import { DeviceId } from '../../deviceId.js';

export default class SlvCtrlPlusDeviceFactory
{
    protected readonly eventEmitterFactory: EventEmitterFactory;

    private readonly dateFactory: DateFactory;

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
        this.logger = logger.child({ name: SlvCtrlPlusDeviceFactory.name });
    }

    public async create(detectionId: DetectionId, transport: DeviceBidirectionalTransport, provider: string): Promise<GenericSlvCtrlPlusDevice> {
        const deviceInfo = await this.getDeviceInfo(transport);
        const protocol = deviceInfo.protocol;

        const knownDevice = this.knownDeviceRegistry.resolve(DeviceId.fromDetectionId(detectionId), deviceInfo.deviceType, provider);
        const deviceAttributes = await SlvCtrlPlusDeviceFactory.getAttributes(transport, protocol);

        const device = new GenericSlvCtrlPlusDevice(
            {
                deviceId: knownDevice.id,
                deviceName: knownDevice.name,
                provider: provider,
                connectedSince: this.dateFactory.now(),
                controllable: true,
            },
            deviceInfo.fwVersion,
            deviceInfo.deviceType,
            protocol,
            transport,
            deviceInfo.protocolVersion,
            deviceAttributes,
            this.eventEmitterFactory.create(),
            this.logger,
        );

        this.knownDeviceRegistry.persist(knownDevice);

        return device;
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
            throw new Error(`Could not retrieve device information: ${reason}`);
        }

        const deviceInfo = decodedInfoResponse.message.data;
        const { fw, protocol: protocolVersionRaw, type: deviceType } = deviceInfo;

        if (undefined === fw || undefined === protocolVersionRaw || undefined === deviceType) {
            throw new Error(`Missing required device info fields: fw='${fw}', protocol='${protocolVersionRaw}', type='${deviceType}'`);
        }

        const fwVersion = Number.parseInt(fw, 10);
        const protocolVersion = Number.parseInt(protocolVersionRaw, 10);

        if (Number.isNaN(fwVersion) || Number.isNaN(protocolVersion)) {
            throw new Error(
                `Invalid version payload: fw='${deviceInfo.fw}', protocol='${deviceInfo.protocol}'`,
            );
        }

        return { fwVersion, protocolVersion, deviceType, protocol };
    }

    private getProtocol(introductionResult: string): SlvCtrlProtocol {
        if (/^introduce;([^,;]+),(\d+),(\d+)$/.test(introductionResult)) {
            this.logger.info('SlvCtrl protocol <V1 detected');
            return new SlvCtrlProtocolLegacy();
        }

        return new SlvCtrlProtocolV1();
    }

    private static async getAttributes(transport: DeviceBidirectionalTransport, protocol: SlvCtrlProtocol): Promise<SlvCtrlPlusDeviceAttributes>
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
            throw new Error(`Could not retrieve device attributes: ${reason}`);
        }

        return protocol.getAttributes(decodedAttrResponse.message.data);
    }
}
