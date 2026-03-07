export type ProtocolError =
    | { type: 'invalid_frame'; reason: string }
    | { type: 'checksum_failed' }
    | { type: 'unknown_message_type' };

export type DecodeResult<TMessage> =
    | { message: TMessage }
    | { error: ProtocolError };

// eslint-disable-next-line no-underscore-dangle
declare const __responseType__: unique symbol;

export type MessageResponse<TMessage, TResponse> = {
    message: TMessage;
} & { [__responseType__]?: TResponse };

export type InferMR<P> = P extends DeviceProtocol<infer MR extends MessageResponse<any, any>> ? MR : never;
export type InferMessage<MR> = MR extends MessageResponse<infer M, unknown> ? M : never;
export type InferResponse<MR> = MR extends MessageResponse<unknown, infer R> ? R : never;

export default interface DeviceProtocol<MR extends MessageResponse<any, any>>
{
    encode(message: InferMessage<MR>): Buffer;
    decode(data: Buffer): DecodeResult<InferResponse<MR>>;
    isResponseMatchingMessage(response: InferResponse<MR>, message: MR): boolean;
}

export const getErrorFromDecodeResult = (protocolError: ProtocolError, transportResponse: Buffer): Error => {
    switch (protocolError.type) {
        case 'invalid_frame':
            return new Error(`Invalid frame for response '${transportResponse.toString('utf-8')}': ${protocolError.reason}`);
        case 'checksum_failed':
            return new Error(`Checksum validation failed for response: ${transportResponse.toString('utf-8')}`);
        case 'unknown_message_type':
            return new Error(`Unknown message type received for response: ${transportResponse.toString('utf-8')}`);
    }
};
