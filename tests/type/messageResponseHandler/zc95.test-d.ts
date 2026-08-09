import { expectTypeOf } from 'vitest';
import type MessageResponseHandler from '../../../src/device/protocol/messageResponseHandler.js';
import type Zc95Protocol from '../../../src/device/protocol/zc95/zc95Protocol.js';
import type Zc95MessageFactory from '../../../src/device/protocol/zc95/zc95MessageFactory.js';
import type { VersionMsgResponse, AckMsgResponse } from '../../../src/device/protocol/zc95/zc95MessageFactory.js';

declare const handler: MessageResponseHandler<Zc95Protocol>;
declare const msgFactory: Zc95MessageFactory;

// every zc95 message carries a response identifier, so send() always resolves
// to that message's specific response type (never void)
expectTypeOf(handler.send(msgFactory.createGetVersionDetails())).toEqualTypeOf<Promise<VersionMsgResponse>>();
expectTypeOf(handler.send(msgFactory.createPatternStart(1))).toEqualTypeOf<Promise<AckMsgResponse>>();
expectTypeOf(handler.send(msgFactory.createSetPower(1, 2, 3, 4))).toEqualTypeOf<Promise<AckMsgResponse>>();

// @ts-expect-error a plain object that isn't a Zc95ProtocolMessage is rejected
handler.send({ foo: 'bar' });
