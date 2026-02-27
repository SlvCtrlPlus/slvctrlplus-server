import { SlvCtrlPlusDeviceAttributes } from './slvCtrlPlusDevice.js';
import DeviceProtocol, { DecodeResult } from '../deviceProtocol.js';

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

export default abstract class SlvCtrlProtocol implements DeviceProtocol<SlvCtrlProtocolCommand, SlvCtrlProtocolResponse>
{
    public static readonly transportTimeoutMs = 175;

    public abstract encode(command: SlvCtrlProtocolCommand): Buffer;
    public abstract decode(data: Buffer): DecodeResult<SlvCtrlProtocolResponse>;

    public abstract getAttributes(responseData: KeyValuePairs): SlvCtrlPlusDeviceAttributes;
}
