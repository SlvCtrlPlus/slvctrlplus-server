import type { SlvCtrlPlusDeviceAttributes } from './slvCtrlPlusDevice.js';
import type { DecodeResult, InferMessage, InferResponse, MessageWithResponse } from '../deviceProtocol.js';
import type DeviceProtocol from '../deviceProtocol.js';

export type DeviceInfo = {
    deviceType: string;
    fwVersion: number;
    protocolVersion: number;
};
export type KeyValuePairs = Record<string, string>;
export type Result = {
    status: 'ok' | 'error' | 'unknown';
    reason?: string;
} & Record<string, string>;
export type SlvCtrlProtocolCommand = {
    command: string;
    args: (string | number | boolean)[];
};
export type SlvCtrlProtocolResponse = {
    command: string;
    data: KeyValuePairs;
    result: Result;
};

export type SlvCtrlProtocolMessage = MessageWithResponse<SlvCtrlProtocolCommand, SlvCtrlProtocolResponse>;

export default abstract class SlvCtrlProtocol implements DeviceProtocol<SlvCtrlProtocolMessage>
{
    public static readonly EOF = '\n';
    public static readonly transportTimeoutMs = 175;

    protected static readonly segmentSeparator = ';';
    protected static readonly attributeSeparator = ',';
    protected static readonly keyValueSeparator = ':';

    protected static readonly rangeSegmentCount = 3;
    protected static readonly attributeSegmentCount = 3;
    protected static readonly introductionSegmentCount = 3;

    public isResponseMatchingMessage(response: InferResponse<SlvCtrlProtocolMessage>, message: SlvCtrlProtocolMessage): boolean {
        return response.command === this.encode(message.message).toString();
    }

    public abstract encode(command: InferMessage<SlvCtrlProtocolMessage>): Buffer;
    public abstract decode(data: Buffer): DecodeResult<InferResponse<SlvCtrlProtocolMessage>>;

    public abstract getAttributes(responseData: KeyValuePairs): SlvCtrlPlusDeviceAttributes;
}
