import EventEmitter from 'events';
import DeviceProtocol from './protocol/deviceProtocol.js';
import DeviceTransport from './transport/deviceTransport.js';
import { clearTimeout } from 'node:timers';

export default class MessageResponseConnection<M, R>
{
    private static responseReceivedEvent: string = 'responseReceived';

    private readonly responseEmitter: EventEmitter;

    private readonly messageResponseMatcher: (message: M, response: R) => boolean;

    private readonly protocol: DeviceProtocol<M, R>;

    private readonly transport: DeviceTransport;

    public constructor(
        responseEmitter: EventEmitter,
        messageResponseMatcher: (message: M, response: R) => boolean,
        protocol: DeviceProtocol<M, R>,
        transport: DeviceTransport
    ) {
        this.responseEmitter = responseEmitter;
        this.messageResponseMatcher = messageResponseMatcher;
        this.protocol = protocol;
        this.transport = transport;

        this.transport.receive(async data => this.processData(data));
    }

    public async send(message: M, timeoutMs = 200): Promise<R> {
        const encodedMsg = this.protocol.encode(message);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(
                () => {
                    this.responseEmitter.off(MessageResponseConnection.responseReceivedEvent, onResponse);
                    reject(new Error(`Timed out (>${timeoutMs}ms) waiting for response`));
                },
                timeoutMs
            );

            const onResponse = (response: R | null) => {
                if(null !== response && this.messageResponseMatcher(message, response)) {
                    clearTimeout(timeout);
                    this.responseEmitter.off(MessageResponseConnection.responseReceivedEvent, onResponse);
                    resolve(response);
                }
            };

            this.responseEmitter.on(MessageResponseConnection.responseReceivedEvent, onResponse);

            this.transport.send(encodedMsg).catch(error => {
                clearTimeout(timeout);
                this.responseEmitter.off(MessageResponseConnection.responseReceivedEvent, onResponse);
                reject(error);
            });
        });
    }

    private async processData(data: Buffer): Promise<void> {
        const response = this.protocol.decode(data);

        this.responseEmitter.emit(MessageResponseConnection.responseReceivedEvent, response);
    }
}
