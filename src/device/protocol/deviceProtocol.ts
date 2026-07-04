export type ProtocolError =
    | { type: 'invalid_frame'; reason: string }
    | { type: 'checksum_failed' }
    | { type: 'unknown_message_type' };

export type DecodeResult<TMessage> =
    | { message: TMessage }
    | { error: ProtocolError };

export type Message<T> = {
    message: T;
}

export type MessageWithResponse<T, R> = Message<T> & {
    responseType: R|undefined;
}

export type MessageWithOptionalResponse<T, R> = Message<T>|MessageWithResponse<T, R>;

export type InferMR<P> = P extends DeviceProtocol<infer T extends Message<any>> ? T : never;
export type InferMessage<MR> =  MR extends MessageWithResponse<infer M, unknown> ? M :
  MR extends Message<infer M> ? M : never;
export type InferResponse<MR> = MR extends MessageWithResponse<unknown, infer R> ? R :
  MR extends Message<any> ? void : never;

export default interface DeviceProtocol<MR extends MessageWithOptionalResponse<any, any>>
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
