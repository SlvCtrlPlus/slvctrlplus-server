import DeviceProtocol, { InferMR, InferResponse, MessageResponse } from '../deviceProtocol.js';
import DeviceTransport from '../../transport/deviceTransport.js';
import EventEmitter from 'events';
import { clearTimeout } from 'node:timers';

export default class MessageResponseHandler<P extends DeviceProtocol<any>>
{
    private static msgResponseReceivedEvent = 'msgResponseReceived'

    private readonly protocol: P;
    private readonly transport: DeviceTransport;
    private readonly responseMatcher: (response: InferResponse<InferMR<P>>, message: InferMR<P>) => boolean;
    private readonly recvWaitingEmitter: EventEmitter;

    public static create<MR extends MessageResponse<any, any>>(
        protocol: DeviceProtocol<MR>,
        transport: DeviceTransport,
        responseMatcher: (response: InferResponse<MR>, message: MR) => boolean,
        recvWaitingEmitter: EventEmitter
    ) {
        return new this(protocol, transport, responseMatcher, recvWaitingEmitter);
    }

    private constructor(
        protocol: P,
        transport: DeviceTransport,
        responseMatcher: (response: InferResponse<InferMR<P>>, message: InferMR<P>) => boolean,
        recvWaitingEmitter: EventEmitter
    ) {
        this.protocol = protocol;
        this.transport = transport;
        this.responseMatcher = responseMatcher;
        this.recvWaitingEmitter = recvWaitingEmitter;
    }

    // @todo: Switch from event based message matching to map based message matching where we store all pending
    //        promises and the messages they sent to see if we can resolve one when we receive message
    public async sendMsgAndAwaitResponse<MR extends InferMR<P>>(
        msg: MR,
        timeoutMs = 200 // @todo: maybe do a global timeoutMs with possibility to override it per specific call like here
    ): Promise<InferResponse<MR>> {
        const encodedMsg = this.protocol.encode(msg.message);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(
                () => {
                    clearTimeout(timeout);
                    this.recvWaitingEmitter.off(MessageResponseHandler.msgResponseReceivedEvent, onResponse);
                    reject(new Error(`Timed out (>${timeoutMs}ms) waiting for response`));
                },
                timeoutMs
            );

            const onResponse = (response: InferResponse<MR> | null) => {
                if(null !== response &&
                    this.responseMatcher(response, msg)
                ) {
                    clearTimeout(timeout);
                    this.recvWaitingEmitter.off(MessageResponseHandler.msgResponseReceivedEvent, onResponse);
                    resolve(response);
                }
            };

            this.recvWaitingEmitter.on(MessageResponseHandler.msgResponseReceivedEvent, onResponse);

            this.transport.send(encodedMsg).catch(error => {
                clearTimeout(timeout);
                this.recvWaitingEmitter.off(MessageResponseHandler.msgResponseReceivedEvent, onResponse);
                reject(error);
            });
        });
    }
}