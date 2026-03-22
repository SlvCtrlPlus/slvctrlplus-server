import DeviceProtocol, { DecodeResult, InferMessage, InferResponse } from '../deviceProtocol.js';
import { Msg, MsgAndResponseIdentifier, MsgResponse } from './zc95MessageFactory.js';
import BaseError from 'modern-errors';

export default class Zc95Protocol<F extends MsgAndResponseIdentifier<Msg, MsgResponse> = MsgAndResponseIdentifier<Msg, MsgResponse>> implements DeviceProtocol<F>
{
    public static readonly STX = 0x02;
    public static readonly ETX = 0x03;
    public static readonly EOT = 0x04;

    public encode(message: InferMessage<F>): Buffer {
        return Buffer.from(JSON.stringify(message), 'utf-8');
    }

    public decode(data: Buffer): DecodeResult<InferResponse<F>> {
        try {
            const jsonResponse = JSON.parse(data.toString('utf-8'));

            return {
                message: jsonResponse,
            }
        } catch (e: unknown) {
            const error = BaseError.normalize(e);
            return {
                error: {
                    type: 'invalid_frame',
                    reason: `Could not parse JSON: ${error.message}`,
                }
            }
        }
    }

    public isResponseMatchingMessage(response: InferResponse<F>, messageResponse: F): boolean {
        return response.MsgId === messageResponse.responseIdentifier.msgId
            && response.Type === messageResponse.responseIdentifier.type;
    }
}