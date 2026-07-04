import DeviceProtocol, { DecodeResult, Message, MessageWithResponse } from '../deviceProtocol.js';

export type AiroticProtocolMessageWithResponse = MessageWithResponse<Buffer, string>;
export type AiroticProtocolMessageWithoutResponse = Message<Buffer>;
export type AiroticProtocolMessage = AiroticProtocolMessageWithResponse | AiroticProtocolMessageWithoutResponse;

export default class AiroticProtocol implements DeviceProtocol<AiroticProtocolMessage>
{
    public encode(message: Buffer): Buffer {
        return message;
    }

    public decode(data: Buffer): DecodeResult<string> {
        return {
            message: data.toString('utf8'),
        }
    }

    public isResponseMatchingMessage(response: string, message: AiroticProtocolMessage): boolean {
        if (message.message.equals(Buffer.from('!H')) && response.startsWith('Hello I am bottle')) {
            return true;
        }

        return false;
    }

    public static createHelloMessage(): AiroticProtocolMessageWithResponse {
        return { message: Buffer.from('!H', 'utf8'), responseType: undefined };
    }

    public static createSelectRestColorMessage(): AiroticProtocolMessageWithoutResponse {
        return { message: Buffer.from('!B1', 'utf8') };
    }

    public static createSelectBreathInColorMessage(): AiroticProtocolMessageWithoutResponse {
        return { message: Buffer.from('!B2', 'utf8') };
    }

    public static createSetColorMessage(r: number, g: number, b: number): AiroticProtocolMessageWithoutResponse {
        const command = Buffer.from('!C', 'utf8');
        const color = Buffer.from([r, g, b]);
        return { message: Buffer.concat([command, color]) };
    }

    public static createResetColorsMessage(): AiroticProtocolMessageWithoutResponse {
        return { message: Buffer.from('!B3', 'utf8') };
    }

    public static createRebootMessage(): AiroticProtocolMessageWithoutResponse {
        return { message: Buffer.from('!B4', 'utf8') };
    }
}
