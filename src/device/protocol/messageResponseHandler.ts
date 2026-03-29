import DeviceProtocol, { InferMR, InferResponse, MessageWithOptionalResponse, MessageWithResponse } from './deviceProtocol.js';
import DeviceTransport from '../transport/deviceTransport.js';
import { clearTimeout } from 'node:timers';
import Logger from '../../logging/Logger.js';
import { promiseWithTimeout } from '../../util/async.js';

type PendingEntry<MR> = {
    msg: MR;
    resolve: (response: InferResponse<MR>) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
    timeoutMs: number,
    pendingSince: number,
};

export default class MessageResponseHandler<P extends DeviceProtocol<MessageWithOptionalResponse<any, any>>>
{
    private readonly protocol: P;
    private readonly transport: DeviceTransport;
    private readonly logger: Logger;
    private readonly pendingEntries: Set<PendingEntry<InferMR<P>>> = new Set();

    public static create<P extends DeviceProtocol<MessageWithOptionalResponse<any, any>>>(
        protocol: P,
        transport: DeviceTransport,
        logger: Logger,
    ): MessageResponseHandler<P> {
        return new this(protocol, transport, logger);
    }

    private constructor(
        protocol: P,
        transport: DeviceTransport,
        logger: Logger,
    ) {
        this.protocol = protocol;
        this.transport = transport;
        this.logger = logger.child({ name: `${MessageResponseHandler.name}.${transport.getDeviceIdentifier()}` });

        transport.onReceive(data => this.onResponse(data));
        transport.onClose(async () => {
            for (const entry of this.pendingEntries) {
                clearTimeout(entry.timeout);
                entry.reject(new Error('Transport closed before a response was received'));
            }
            this.pendingEntries.clear();
        });
    }

    private onResponse(data: Buffer): void {
        const decodedMessage = this.protocol.decode(data);

        if ('error' in decodedMessage) {
            this.logger.error(`Could not decode message`, decodedMessage.error);
            return;
        }

        const message = decodedMessage.message;

        for (const entry of this.pendingEntries) {
            if (this.protocol.isResponseMatchingMessage(message, entry.msg)) {
                clearTimeout(entry.timeout);
                this.pendingEntries.delete(entry);
                entry.resolve(message);
                const responseTime = Date.now() - entry.pendingSince;

                if (responseTime > entry.timeoutMs * 0.8) {
                    this.logger.warn(
                        `Slow response time (${responseTime}ms) for message: ${JSON.stringify(entry.msg.message)}`
                    );
                }

                return;
            }
        }
    }

    private isMessageWithResponse<T extends InferMR<P>>(
        msg: T
    ): msg is Extract<T, MessageWithResponse<any, any>> {
        return 'responseType' in msg;
    }

    public async send<MR extends InferMR<P>>(
        msg: MR,
        timeoutMs = 200
    ): Promise<InferResponse<MR>> {
        const encodedMsg = this.protocol.encode(msg.message);

        if (false === this.isMessageWithResponse(msg)) {
            return promiseWithTimeout(new Promise<InferResponse<MR>>((resolve, reject) => {
                console.log(`Sending message without expected response: ${encodedMsg.toString('utf-8')}`);
                this.transport.send(encodedMsg).then(() => {
                    console.log(`Message sent without expected response: ${encodedMsg.toString('utf-8')}`);
                    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                    resolve(undefined as InferResponse<MR>);
                }).catch(reject);
            }), timeoutMs);
        }

        return new Promise<InferResponse<MR>>((resolve, reject) => {
            const entry = {
                msg,
                resolve: resolve,
                reject,
                timeout: setTimeout(() => {
                    this.pendingEntries.delete(entry);
                    reject(new Error(
                        `Timed out (>${timeoutMs}ms) waiting for response for message: ${encodedMsg.toString()}`
                    ));
                }, timeoutMs),
                timeoutMs,
                pendingSince: Date.now(),
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