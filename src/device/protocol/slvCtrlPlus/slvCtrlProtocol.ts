import { SlvCtrlPlusDeviceAttributes } from './slvCtrlPlusDevice.js';
import DeviceProtocol, { DecodeResult, MessageResponse } from '../deviceProtocol.js';

export type DeviceInfo = {
    deviceType: string,
    fwVersion: number,
    protocolVersion: number,
};
export type KeyValuePairs = { [key: string]: string };
export type Result = {
    status: 'ok' | 'error' | 'unknown',
    reason?: string,
} & {
    [key: string]: string,
}
export type SlvCtrlProtocolCommand = {
    command: string;
    args: (string|number|boolean)[];
};
export type SlvCtrlProtocolResponse = {
    command: string,
    data: KeyValuePairs,
    result: Result,
}

export default abstract class SlvCtrlProtocol implements DeviceProtocol<MessageResponse<SlvCtrlProtocolCommand, SlvCtrlProtocolResponse>>
{
    public static readonly EOF = '\n';
    public static readonly transportTimeoutMs = 175;

    public abstract encode(command: SlvCtrlProtocolCommand): Buffer;
    public abstract decode(data: Buffer): DecodeResult<SlvCtrlProtocolResponse>;

    public abstract getAttributes(responseData: KeyValuePairs): SlvCtrlPlusDeviceAttributes;

    public isResponseMatchingMessage(response: SlvCtrlProtocolResponse, message: MessageResponse<SlvCtrlProtocolCommand, SlvCtrlProtocolResponse>): boolean {
        return response.command === this.encode(message.message).toString();
    }
}
