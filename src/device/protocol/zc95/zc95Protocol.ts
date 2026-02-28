import DeviceProtocol, { DecodeResult } from '../deviceProtocol.js';
import { Msg, MsgResponse } from './zc95MessageFactory.js';

const STX = 0x02;
const ETX = 0x03;

export default class Zc95Protocol implements DeviceProtocol<Msg, MsgResponse>
{
    public encode(command: Msg): Buffer {
        const message = JSON.stringify(command);

        return Buffer.concat([
            Buffer.from([STX]),
            Buffer.from(message, 'utf-8'),
            Buffer.from([ETX]),
        ])
    }

    public decode(data: Buffer): DecodeResult<MsgResponse> {
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