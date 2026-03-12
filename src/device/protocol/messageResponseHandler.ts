import DeviceProtocol, { InferMR, InferResponse, MessageResponse } from './deviceProtocol.js';
import DeviceTransport from '../transport/deviceTransport.js';
import { clearTimeout } from 'node:timers';
import Logger from '../../logging/Logger.js';

type PendingEntry<MR> = {
    msg: MR;
    resolve: (response: InferResponse<MR>) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
    pendingSince: number,
};

export default class MessageResponseHandler<P extends DeviceProtocol<MessageResponse<any, any>>>
{
    private readonly protocol: P;
    private readonly transport: DeviceTransport;
    private readonly logger: Logger;
    private readonly pendingEntries: Set<PendingEntry<InferMR<P>>> = new Set();

    public static create<MR extends MessageResponse<any, any>>(
        protocol: DeviceProtocol<MR>,
        transport: DeviceTransport,
        logger: Logger,
    ) {
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

        transport.onReceive(async data => this.onResponse(data));
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

                if (responseTime > 200) {
                    this.logger.warn(
                        `Slow response time (${responseTime}ms) for message: ${JSON.stringify(entry.msg.message)}`
                    );
                }

                return;
            }
        }
    }

    public async send<MR extends InferMR<P>>(
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
                    reject(new Error(
                        `Timed out (>${timeoutMs}ms) waiting for response for message: ${encodedMsg.toString()}`
                    ));
                }, timeoutMs),
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