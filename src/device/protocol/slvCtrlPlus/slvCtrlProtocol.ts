import { SlvCtrlPlusDeviceAttributes } from './slvCtrlPlusDevice.js';
import DeviceProtocol, { DecodeResult, InferMessage, InferResponse, MessageWithResponse } from '../deviceProtocol.js';

export interface DeviceInfo {
    deviceType: string,
    fwVersion: number,
    protocolVersion: number,
}
export type KeyValuePairs = Record<string, string>;
export type Result = {
    status: 'ok' | 'error' | 'unknown',
    reason?: string,
} & Record<string, string>
export interface SlvCtrlProtocolCommand {
    command: string;
    args: (string|number|boolean)[];
}
export interface SlvCtrlProtocolResponse {
    command: string,
    data: KeyValuePairs,
    result: Result,
}

export type SlvCtrlProtocolMessage = MessageWithResponse<SlvCtrlProtocolCommand, SlvCtrlProtocolResponse>;

export default abstract class SlvCtrlProtocol implements DeviceProtocol<SlvCtrlProtocolMessage>
{
    public static readonly EOF = '\n';
    public static readonly transportTimeoutMs = 175;

    public abstract encode(command: InferMessage<SlvCtrlProtocolMessage>): Buffer;
    public abstract decode(data: Buffer): DecodeResult<InferResponse<SlvCtrlProtocolMessage>>;

    public abstract getAttributes(responseData: KeyValuePairs): SlvCtrlPlusDeviceAttributes;

    public isResponseMatchingMessage(response: InferResponse<SlvCtrlProtocolMessage>, message: SlvCtrlProtocolMessage): boolean {
        return response.command === this.encode(message.message).toString();
    }
}
