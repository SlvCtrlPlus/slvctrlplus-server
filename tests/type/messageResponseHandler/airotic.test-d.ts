import { expectTypeOf } from 'vitest';
import type MessageResponseHandler from '../../../src/device/protocol/messageResponseHandler.js';
import AiroticProtocol from '../../../src/device/protocol/airotic/airoticProtocol.js';

declare const handler: MessageResponseHandler<AiroticProtocol>;

// message with a response type resolves to that response type
expectTypeOf(handler.send(AiroticProtocol.createHelloMessage())).toEqualTypeOf<Promise<string>>();

// messages without a response type resolve to void
expectTypeOf(handler.send(AiroticProtocol.createSelectRestColorMessage())).toEqualTypeOf<Promise<void>>();
expectTypeOf(handler.send(AiroticProtocol.createResetColorsMessage())).toEqualTypeOf<Promise<void>>();
expectTypeOf(handler.send(AiroticProtocol.createRebootMessage())).toEqualTypeOf<Promise<void>>();

// @ts-expect-error a plain object that isn't an AiroticProtocolMessage is rejected
handler.send({ foo: 'bar' });
