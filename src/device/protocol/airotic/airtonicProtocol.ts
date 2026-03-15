import DeviceProtocol, { DecodeResult, MessageResponse } from '../deviceProtocol.js';

export default class AiroticProtocol implements DeviceProtocol<MessageResponse<string, string>>
{
    public encode(message: string): Buffer {
        return Buffer.from(message, 'utf8');
    }

    public decode(data: Buffer): DecodeResult<string> {
        return {
            message: data.toString('utf8'),
        }
    }

    public isResponseMatchingMessage(response: string, message: MessageResponse<string, string>): boolean {
        if (message.message === '!H' && response.startsWith('Hello I am bottle')) {
            return true;
        }

        return false;
    }

    public static createHelloMessage(): MessageResponse<string, string> {
        return { message: '!H' };
    }
}
