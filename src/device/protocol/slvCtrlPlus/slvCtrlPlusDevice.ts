import { Exclude } from 'class-transformer';
import type { AnyDeviceConfig, NoDeviceConfig } from '../../deviceConfig.js';
import type { DeviceAttributeValues, DeviceInfo, DeviceNotifications, NoDeviceNotifications } from '../../device.js';
import type { SlvCtrlProtocolCommand, SlvCtrlProtocolResponse } from './slvCtrlProtocol.js';
import SlvCtrlProtocol from './slvCtrlProtocol.js';
import type DeviceBidirectionalTransport from '../../transport/deviceBidirectionalTransport.js';
import PeripheralDevice from '../../peripheralDevice.js';
import { getErrorFromDecodeResult } from '../deviceProtocol.js';
import type EventEmitter from 'events';
import type Logger from '../../../logging/Logger.js';
import type { TSchema } from '@sinclair/typebox';
import type JsonSchemaValidatorFactory from '../../../schemaValidation/JsonSchemaValidatorFactory.js';

@Exclude()
export default abstract class SlvCtrlPlusDevice<
    TDeviceData extends DeviceAttributeValues = DeviceAttributeValues,
    TNotifications extends DeviceNotifications = NoDeviceNotifications,
    TConfig extends AnyDeviceConfig = NoDeviceConfig,
> extends PeripheralDevice<SlvCtrlProtocol, TDeviceData, TNotifications, TConfig> {
    protected constructor(
        deviceInfo: DeviceInfo,
        protocol: SlvCtrlProtocol,
        transport: DeviceBidirectionalTransport,
        attributesSchema: TSchema,
        attributes: TDeviceData,
        validatorFactory: JsonSchemaValidatorFactory,
        config: TConfig,
        eventEmitter: EventEmitter,
        logger: Logger,
    ) {
        super(deviceInfo, protocol, transport, attributesSchema, attributes, validatorFactory, config, eventEmitter, logger);
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
