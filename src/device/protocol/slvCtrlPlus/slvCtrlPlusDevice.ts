import { Exclude } from 'class-transformer';
import DeviceAttribute from '../../attribute/deviceAttribute.js';
import { AnyDeviceConfig, NoDeviceConfig } from '../../deviceConfig.js';
import SlvCtrlProtocol, { SlvCtrlProtocolCommand, SlvCtrlProtocolResponse } from './slvCtrlProtocol.js';
import DeviceBidirectionalTransport from '../../transport/deviceBidirectionalTransport.js';
import PeripheralDevice from '../../peripheralDevice.js';
import { getErrorFromDecodeResult } from '../deviceProtocol.js';
import EventEmitter from 'events';
import Logger from '../../../logging/Logger.js';
import { DeviceId } from '../../deviceId.js';

export type SlvCtrlPlusDeviceAttributeKey = string;
export type SlvCtrlPlusDeviceAttributes = Record<SlvCtrlPlusDeviceAttributeKey, DeviceAttribute>;

@Exclude()
export default abstract class SlvCtrlPlusDevice<
    TAttributes extends SlvCtrlPlusDeviceAttributes = SlvCtrlPlusDeviceAttributes,
    TConfig extends AnyDeviceConfig = NoDeviceConfig,
> extends PeripheralDevice<SlvCtrlProtocol, TAttributes, TConfig> {
    protected readonly logger: Logger;

    protected constructor(
        deviceId: DeviceId,
        deviceName: string,
        provider: string,
        connectedSince: Date,
        protocol: SlvCtrlProtocol,
        transport: DeviceBidirectionalTransport,
        controllable: boolean,
        attributes: TAttributes,
        config: TConfig,
        eventEmitter: EventEmitter,
        logger: Logger,
    ) {
        super(deviceId, deviceName, provider, connectedSince, controllable, protocol, transport, attributes, config, eventEmitter);

        this.logger = logger;
    }

    protected async send(command: SlvCtrlProtocolCommand): Promise<SlvCtrlProtocolResponse>
    {
        const encodedCommand = this.protocol.encode(command);
        const response = await this.transport.sendAndAwaitReceive(encodedCommand, SlvCtrlProtocol.transportTimeoutMs);
        const decodedResponse = this.protocol.decode(response);

        if ('error' in decodedResponse) {
            throw getErrorFromDecodeResult(decodedResponse.error, response);
        }

        const message = decodedResponse.message;

        if (encodedCommand.toString('utf-8') !== message.command) {
            throw new Error(`Received response for unexpected command. Expected: ${command.command}, Received: ${message.command}`);
        }

        if (message.result.status !== 'ok') {
            const reason = message.result.reason ?? 'unknown';
            throw new Error(`Querying device status failed. Result: ${message.result.status}, Reason: ${reason}`);
        }

        return message;
    }
}
