export type ProtocolError =
    | { type: 'invalid_frame'; reason: string }
    | { type: 'checksum_failed' }
    | { type: 'unknown_message_type' };

export type DecodeResult<TMessage> =
    | { message: TMessage }
    | { error: ProtocolError };

export default interface DeviceProtocol<TCommand, TMessage>
{
    encode(command: TCommand): string;
    decode(data: string): DecodeResult<TMessage>;
}

export const getErrorFromDecodeResult = (protocolError: ProtocolError, transportResponse: string): Error => {
    switch (protocolError.type) {
        case 'invalid_frame':
            return new Error(`Invalid frame for response '${transportResponse}': ${protocolError.reason}`);
        case 'checksum_failed':
            return new Error(`Checksum validation failed for response: ${transportResponse}`);
        case 'unknown_message_type':
            return new Error(`Unknown message type received for response: ${transportResponse}`);
    }
};
