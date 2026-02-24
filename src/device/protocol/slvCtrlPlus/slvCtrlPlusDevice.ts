import { Exclude } from 'class-transformer';
import Device from '../../device.js';
import DeviceAttribute from '../../attribute/deviceAttribute.js';
import { AnyDeviceConfig, NoDeviceConfig } from '../../deviceConfig.js';
import SlvCtrlProtocol, { SlvCtrlProtocolCommand, SlvCtrlProtocolResponse } from './slvCtrlProtocol.js';
import DeviceTransport from '../../transport/deviceTransport.js';
import PeripheralDevice from '../../peripheralDevice.js';
import { getErrorFromDecodeResult } from '../deviceProtocol.js';

export type SlvCtrlPlusDeviceAttributeKey = string;
export type SlvCtrlPlusDeviceAttributes = Record<SlvCtrlPlusDeviceAttributeKey, DeviceAttribute>;

@Exclude()
export default abstract class SlvCtrlPlusDevice<
    TAttributes extends SlvCtrlPlusDeviceAttributes = SlvCtrlPlusDeviceAttributes,
    TConfig extends AnyDeviceConfig = NoDeviceConfig,
> extends PeripheralDevice<SlvCtrlProtocol, TAttributes, TConfig> {
    protected constructor(
        deviceId: string,
        deviceName: string,
        provider: string,
        connectedSince: Date,
        protocol: SlvCtrlProtocol,
        transport: DeviceTransport,
        controllable: boolean,
        attributes: TAttributes,
        config: TConfig
    ) {
        super(deviceId, deviceName, provider, connectedSince, controllable, protocol, transport, attributes, config);
    }

    protected async send(command: SlvCtrlProtocolCommand): Promise<SlvCtrlProtocolResponse>
    {
        const response = await this.transport.sendAndAwaitReceive(this.protocol.encode(command));
        const decodedResponse = this.protocol.decode(response);

        if ('error' in decodedResponse) {
            throw getErrorFromDecodeResult(decodedResponse.error, response);
        }

        const message = decodedResponse.message;

        if (command.command !== message.command) {
            throw new Error(`Received response for unexpected command. Expected: ${command.command}, Received: ${message.command}`);
        }

        if (message.result.status !== 'ok') {
            const reason = message.result.reason ?? 'unknown';
            throw new Error(`Querying device status failed. Result: ${message.result.status}, Reason: ${reason}`);
        }

        return message;
    }

    protected getSerialTimeout(): number {
        return 0;
    }
}
