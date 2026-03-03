import DeviceProtocol, { InferMR, InferResponse, MessageResponse } from '../deviceProtocol.js';
import DeviceTransport from '../../transport/deviceTransport.js';
import { clearTimeout } from 'node:timers';

type PendingEntry<MR> = {
    msg: MR;
    resolve: (response: InferResponse<MR>) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
};

export default class MessageResponseHandler<P extends DeviceProtocol<MessageResponse<any, any>>>
{
    private readonly protocol: P;
    private readonly transport: DeviceTransport;
    private readonly responseMatcher: (response: InferResponse<InferMR<P>>, message: InferMR<P>) => boolean;
    private readonly pendingEntries: Set<PendingEntry<InferMR<P>>> = new Set();

    public static create<MR extends MessageResponse<any, any>>(
        protocol: DeviceProtocol<MR>,
        transport: DeviceTransport,
        responseMatcher: (response: InferResponse<MR>, message: MR) => boolean,
    ) {
        return new this(protocol, transport, responseMatcher);
    }

    private constructor(
        protocol: P,
        transport: DeviceTransport,
        responseMatcher: (response: InferResponse<InferMR<P>>, message: InferMR<P>) => boolean,
    ) {
        this.protocol = protocol;
        this.transport = transport;
        this.responseMatcher = responseMatcher;

        transport.receive(async data => this.onResponse(data));
    }

    private onResponse(data: Buffer): void {
        const decodedMessage = this.protocol.decode(data);

        if ('error' in decodedMessage) {
            console.log(decodedMessage.error);
            return;
        }

        const message = decodedMessage.message;

        for (const entry of this.pendingEntries) {
            if (this.responseMatcher(message, entry.msg)) {
                clearTimeout(entry.timeout);
                this.pendingEntries.delete(entry);
                entry.resolve(message);
                return;
            }
        }
    }

    public async sendMsgAndAwaitResponse<MR extends InferMR<P>>(
        msg: MR,
        timeoutMs = 200
    ): Promise<InferResponse<MR>> {
        const encodedMsg = this.protocol.encode(msg.message);

        return new Promise<InferResponse<MR>>((resolve, reject) => {
            const entry = {
                msg,
                resolve: resolve,
                reject,
                timeout: setTimeout(() => {
                    this.pendingEntries.delete(entry);
                    reject(new Error(`Timed out (>${timeoutMs}ms) waiting for response`));
                }, timeoutMs),
            };

            this.pendingEntries.add(entry);

            this.transport.send(encodedMsg).catch(error => {
                clearTimeout(entry.timeout);
                this.pendingEntries.delete(entry);
                reject(error);
            });
        });
    }
}