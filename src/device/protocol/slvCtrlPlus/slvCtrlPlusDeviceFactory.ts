import UuidFactory from '../../../factory/uuidFactory.js';
import Settings from '../../../settings/settings.js';
import KnownDevice from '../../../settings/knownDevice.js';
import DeviceNameGenerator from '../../deviceNameGenerator.js';
import GenericSlvCtrlPlusDevice from './genericSlvCtrlPlusDevice.js';
import DateFactory from '../../../factory/dateFactory.js';
import DeviceTransport from '../../transport/deviceTransport.js';
import SlvCtrlProtocolLegacy from './slvCtrlProtocolLegacy.js';
import Logger from '../../../logging/Logger.js';
import SlvCtrlProtocolV1 from './slvCtrlProtocolV1.js';
import SlvCtrlProtocol from './slvCtrlProtocol.js';
import { getErrorFromDecodeResult } from '../deviceProtocol.js';

export default class SlvCtrlPlusDeviceFactory
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
        this.logger = logger.child({ name: SlvCtrlPlusDeviceFactory.name });
    }

    public async create(transport: DeviceTransport, provider: string): Promise<GenericSlvCtrlPlusDevice> {
        const deviceInfo = await this.getDeviceInfo(transport);
        const protocol = deviceInfo.protocol;
        const deviceIdentifier = transport.getDeviceIdentifier();
        const knownDevice = this.createKnownDevice(deviceIdentifier, deviceInfo.deviceType, provider);
        const deviceAttributes = await this.getAttributes(transport, protocol);

        const device = new GenericSlvCtrlPlusDevice(
            deviceInfo.fwVersion,
            knownDevice.id,
            knownDevice.name,
            deviceInfo.deviceType,
            provider,
            this.dateFactory.now(),
            protocol,
            transport,
            deviceInfo.protocolVersion,
            deviceAttributes
        );

        this.settings.addKnownDevice(knownDevice);

        return device;
    }

    private async getDeviceInfo(transport: DeviceTransport)
    {
        const infoResponse = await transport.sendAndAwaitReceive(
            Buffer.from(`introduce${SlvCtrlProtocol.eofMarker}`),
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

    private async getAttributes(transport: DeviceTransport, protocol: SlvCtrlProtocol)
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

    private createKnownDevice(serialNo: string, deviceType: string, provider: string): KnownDevice {
        const knownDevice = this.settings.getKnownDeviceById(serialNo)

        if (undefined !== knownDevice) {
            // Return already existing device if already known (previously detected serial number)
            this.logger.debug(`Device is already known: ${knownDevice.id} (${serialNo})`);
            return knownDevice;
        }

        // Create a new device and return if not yet known (new serial number)
        return new KnownDevice(
            this.uuidFactory.create(),
            serialNo,
            this.nameGenerator.generateName(),
            deviceType,
            provider
        );
    }
}
