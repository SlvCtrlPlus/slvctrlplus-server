import type { DecodeResult, InferMessage, InferResponse, MessageWithResponse } from '../deviceProtocol.js';
import type DeviceProtocol from '../deviceProtocol.js';
import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import type JsonSchemaValidatorFactory from '../../../schemaValidation/JsonSchemaValidatorFactory.js';
import type JsonSchemaValidator from '../../../schemaValidation/JsonSchemaValidator.js';
import { parseAndValidateJson } from '../../../util/json.js';
import { normalizeError } from '../../../util/typeUtils.js';

const MsgResponseSchema = Type.Object({
    Type: Type.String(),
    MsgId: Type.Number(),
    Result: Type.Union([Type.Literal('OK'), Type.Literal('ERROR')]),
    Error: Type.Optional(Type.String()),
});

export type MsgResponse = Static<typeof MsgResponseSchema>;

type ResponseToKey<R extends MsgResponse> = R extends { Type: infer T } ? T : never;

export type Msg = {
    Type: string;
    MsgId: number;
};

type ResponseIdentifier<R extends MsgResponse> = {
    msgId: number;
    type: ResponseToKey<R>;
};

export type MsgAndResponseIdentifier<M extends Msg, R extends MsgResponse> = {
    responseIdentifier: ResponseIdentifier<R>;
} & MessageWithResponse<M, R>;

export type Zc95ProtocolMessage = MsgAndResponseIdentifier<Msg, MsgResponse>;

export default class Zc95Protocol implements DeviceProtocol<Zc95ProtocolMessage>
{
    public static readonly STX = 0x02;
    public static readonly ETX = 0x03;
    public static readonly EOT = 0x04;

    private readonly msgResponseValidator: JsonSchemaValidator<typeof MsgResponseSchema>;

    public constructor(jsonSchemaValidatorFactory: JsonSchemaValidatorFactory) {
        this.msgResponseValidator = jsonSchemaValidatorFactory.create(MsgResponseSchema);
    }

    public static createMessage<M extends Msg, R extends MsgResponse>(
        message: M,
        responseType: ResponseToKey<R>,
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

    public encode(message: InferMessage<Zc95ProtocolMessage>): Buffer {
        return Buffer.from(JSON.stringify(message), 'utf-8');
    }

    public decode(data: Buffer): DecodeResult<InferResponse<Zc95ProtocolMessage>> {
        try {
            const jsonResponse = parseAndValidateJson(data.toString('utf-8'), this.msgResponseValidator);

            return {
                message: jsonResponse,
            };
        } catch (e: unknown) {
            return {
                error: {
                    type: 'invalid_frame',
                    reason: normalizeError(e).message,
                },
            };
        }
    }

    public isResponseMatchingMessage(response: InferResponse<Zc95ProtocolMessage>, messageResponse: Zc95ProtocolMessage): boolean {
        return response.MsgId === messageResponse.responseIdentifier.msgId
            && response.Type === messageResponse.responseIdentifier.type;
    }
}
