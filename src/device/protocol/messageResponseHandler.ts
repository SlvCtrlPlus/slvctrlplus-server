import DeviceProtocol, { InferMR, InferResponse, AnyMessageWithResponse, AnyMessageWithOptionalResponse } from './deviceProtocol.js';
import DeviceBidirectionalTransport from '../transport/deviceBidirectionalTransport.js';
import { clearTimeout } from 'node:timers';
import Logger from '../../logging/Logger.js';
import { promiseWithTimeout } from '../../util/async.js';
import { normalizeError } from '../../util/typeUtils.js';

type PendingEntry<MR> = {
    msg: MR;
    resolve: (response: InferResponse<MR>) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
    timeoutMs: number;
    pendingSince: number;
};

type AnyDeviceProtocol = DeviceProtocol<AnyMessageWithOptionalResponse>;

// intersection makes P's inferred message/response type resolvable here (opaque P alone can't)
type TypedProtocol<P extends AnyDeviceProtocol> = DeviceProtocol<InferMR<P>> & P;

export default class MessageResponseHandler<P extends AnyDeviceProtocol>
{
    private readonly protocol: TypedProtocol<P>;
    private readonly transport: DeviceBidirectionalTransport;
    private readonly logger: Logger;
    private readonly pendingEntries = new Set<PendingEntry<InferMR<P>>>();
    private readonly timeoutMs: number;

    public static create<P extends AnyDeviceProtocol>(
        protocol: TypedProtocol<P>,
        transport: DeviceBidirectionalTransport,
        logger: Logger,
        timeoutMs = 200,
    ): MessageResponseHandler<P> {
        return new this(protocol, transport, logger, timeoutMs);
    }

    private constructor(
        protocol: TypedProtocol<P>,
        transport: DeviceBidirectionalTransport,
        logger: Logger,
        timeoutMs: number,
    ) {
        this.protocol = protocol;
        this.transport = transport;
        this.logger = logger.child({ name: `${MessageResponseHandler.name}.${transport.getDeviceIdentifier()}` });
        this.timeoutMs = timeoutMs;

        transport.onReceive(data => this.onResponse(data));
        transport.onClose(() => {
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
                        `Slow response time (${responseTime}ms) for message: ${JSON.stringify(entry.msg.message)}`,
                    );
                }

                break;
            }
        }
    }

    private isMessageWithResponse<T extends InferMR<P>>(
        msg: T,
    ): msg is Extract<T, AnyMessageWithResponse> {
        return 'responseType' in msg;
    }

    public async send<MR extends InferMR<P>>(
        msg: MR,
        timeoutMs?: number,
    ): Promise<InferResponse<MR>> {
        const encodedMsg = this.protocol.encode(msg.message);
        const realTimeoutMs = timeoutMs ?? this.timeoutMs;

        if (!this.isMessageWithResponse(msg)) {
            return promiseWithTimeout(new Promise<InferResponse<MR>>((resolve, reject) => {
                this.transport.send(encodedMsg).then(() => {
                    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                    resolve(undefined as InferResponse<MR>);
                }).catch(reject);
            }), realTimeoutMs, `Message ${encodedMsg.toString()} timed out after ${realTimeoutMs}ms`);
        }

        return new Promise<InferResponse<MR>>((resolve, reject) => {
            const entry = {
                msg,
                resolve: resolve,
                reject,
                timeout: setTimeout(() => {
                    this.pendingEntries.delete(entry);
                    reject(new Error(
                        `Timed out (>${realTimeoutMs}ms) waiting for response for message: ${encodedMsg.toString()}`,
                    ));
                }, realTimeoutMs),
                timeoutMs: realTimeoutMs,
                pendingSince: Date.now(),
            };

            this.pendingEntries.add(entry);

            this.transport.send(encodedMsg).catch((error: unknown) => {
                clearTimeout(entry.timeout);
                this.pendingEntries.delete(entry);
                reject(normalizeError(error));
            });
        });
    }
}
