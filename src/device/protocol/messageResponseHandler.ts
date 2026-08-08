import type { InferMR, InferResponse, AnyMessageWithResponse, AnyMessageWithOptionalResponse } from './deviceProtocol.js';
import type DeviceProtocol from './deviceProtocol.js';
import type DeviceBidirectionalTransport from '../transport/deviceBidirectionalTransport.js';
import { clearTimeout } from 'node:timers';
import type Logger from '../../logging/Logger.js';
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
    private static readonly TIMEOUT_PERCENTAGE_FOR_SLOW_RESPONSE_LOG = 0.8;

    private readonly protocol: TypedProtocol<P>;
    private readonly transport: DeviceBidirectionalTransport;
    private readonly logger: Logger;
    private readonly pendingEntries = new Set<PendingEntry<InferMR<P>>>();
    private readonly timeoutMs: number;

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

    public static create<P extends AnyDeviceProtocol>(
        protocol: TypedProtocol<P>,
        transport: DeviceBidirectionalTransport,
        logger: Logger,
        timeoutMs = 200,
    ): MessageResponseHandler<P> {
        return new this(protocol, transport, logger, timeoutMs);
    }

    public async send<MR extends Extract<InferMR<P>, AnyMessageWithResponse>>(
        msg: MR,
        timeoutMs?: number,
    ): Promise<InferResponse<MR>>;
    public async send(
        msg: Exclude<InferMR<P>, AnyMessageWithResponse>,
        timeoutMs?: number,
    ): Promise<void>;
    public async send<MR extends InferMR<P>>(msg: InferMR<P>, timeoutMs?: number): Promise<InferResponse<MR> | void> {
        const encodedMsg = this.protocol.encode(msg.message);
        const realTimeoutMs = timeoutMs ?? this.timeoutMs;

        if (!this.isMessageWithResponse(msg)) {
            return promiseWithTimeout(
                this.transport.send(encodedMsg),
                realTimeoutMs,
                `Message ${encodedMsg.toString()} timed out after ${realTimeoutMs}ms`,
            );
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

    // Static members cannot reference class type parameters.ts(2302):
    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    private isMessageWithResponse<T extends InferMR<P>>(
        msg: T,
    ): msg is Extract<T, AnyMessageWithResponse> {
        return 'responseType' in msg;
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

                if (responseTime > entry.timeoutMs * MessageResponseHandler.TIMEOUT_PERCENTAGE_FOR_SLOW_RESPONSE_LOG) {
                    this.logger.warn(
                        `Slow response time (${responseTime}ms) for message: ${JSON.stringify(entry.msg.message)}`,
                    );
                }

                break;
            }
        }
    }
}
