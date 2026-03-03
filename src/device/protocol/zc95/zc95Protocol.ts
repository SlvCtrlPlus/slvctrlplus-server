import DeviceProtocol, { DecodeResult, InferMessage, InferResponse } from '../deviceProtocol.js';
import { Msg, MsgAndResponseIdentifier, MsgResponse } from './zc95MessageFactory.js';

const STX = 0x02;
const ETX = 0x03;

export default class Zc95Protocol<F extends MsgAndResponseIdentifier<Msg, MsgResponse> = MsgAndResponseIdentifier<Msg, MsgResponse>> implements DeviceProtocol<F>
{
    public encode(message: InferMessage<F>): Buffer {
        const buffer = JSON.stringify(message);

        return Buffer.concat([
            Buffer.from([STX]),
            Buffer.from(buffer, 'utf-8'),
            Buffer.from([ETX]),
        ])
    }

    public decode(data: Buffer): DecodeResult<InferResponse<F>> {
        try {
            const jsonResponse = JSON.parse(data.toString('utf-8'));

            return {
                message: jsonResponse,
            }
        } catch (e: unknown) {
            return {
                error: {
                    type: 'invalid_frame',
                    reason: `Could not parse JSON: ${(e as SyntaxError).message}`,
                }
            }
        }
    }
}