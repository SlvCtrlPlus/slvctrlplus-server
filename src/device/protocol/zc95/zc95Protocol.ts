import DeviceProtocol, { DecodeResult, InferMessage, InferResponse, MessageWithResponse } from '../deviceProtocol.js';
import BaseError from 'modern-errors';

type ResponseToKey<R extends MsgResponse> = R extends { Type: infer T } ? T : never;

export interface Msg
{
    Type: string;
    MsgId: number;
}

export interface MsgResponse
{
    Type: string;
    MsgId: number;
    Result: 'OK' | 'ERROR'
    Error?: string;
}

export interface ResponseIdentifier<R extends MsgResponse>
{
    msgId: number,
    type: ResponseToKey<R>
}

export interface MsgAndResponseIdentifier<M extends Msg, R extends MsgResponse> extends MessageWithResponse<M, R> {
    responseIdentifier: ResponseIdentifier<R>;
}

export type Zc95ProtocolMessage = MsgAndResponseIdentifier<Msg, MsgResponse>;

export default class Zc95Protocol implements DeviceProtocol<Zc95ProtocolMessage>
{
    public static readonly STX = 0x02;
    public static readonly ETX = 0x03;
    public static readonly EOT = 0x04;

    public encode(message: InferMessage<Zc95ProtocolMessage>): Buffer {
        return Buffer.from(JSON.stringify(message), 'utf-8');
    }

    public decode(data: Buffer): DecodeResult<InferResponse<Zc95ProtocolMessage>> {
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

    public isResponseMatchingMessage(response: InferResponse<Zc95ProtocolMessage>, messageResponse: Zc95ProtocolMessage): boolean {
        return response.MsgId === messageResponse.responseIdentifier.msgId
            && response.Type === messageResponse.responseIdentifier.type;
    }

    public static createMessage<M extends Msg, R extends MsgResponse>(
        message: M,
        responseType: ResponseToKey<R>
    ): MsgAndResponseIdentifier<M, R> {
        const responseIdentifier: ResponseIdentifier<R> = {
            msgId: message.MsgId,
            type: responseType,
        };

        return {
            message,
            responseType: undefined,
            responseIdentifier,
        };
    }
}