import { DecodeResult, ProtocolError } from '../../../src/device/protocol/deviceProtocol.js';
import { expect } from 'vitest';

export function expectToBeSuccessfulDecodeResult(
    value: DecodeResult<any>
): asserts value is { message: any } {
    expect(value).not.toHaveProperty('error');
    expect(value).toHaveProperty('message');
}

export function expectToBeErrorDecodeResult(
    value: DecodeResult<any>
): asserts value is { error: ProtocolError } {
    expect(value).not.toHaveProperty('message');
    expect(value).toHaveProperty('error');
}
