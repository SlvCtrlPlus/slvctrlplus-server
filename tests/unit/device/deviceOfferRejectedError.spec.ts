import { describe, it, expect } from 'vitest';
import DeviceOfferRejectedError from '../../../src/device/deviceOfferRejectedError.js';

describe('DeviceOfferRejectedError', () => {
    it('is an instance of Error', () => {
        const error = new DeviceOfferRejectedError('some reason');

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(DeviceOfferRejectedError);
    });

    it('carries the given message', () => {
        const error = new DeviceOfferRejectedError('Device with id \'foo\' has disappeared');

        expect(error.message).toBe('Device with id \'foo\' has disappeared');
    });

    it('is distinguishable from a plain Error via instanceof, as relied upon by DeviceProvider', () => {
        const rejection: unknown = new DeviceOfferRejectedError('claimed by another provider');
        const genuineFailure: unknown = new Error('connect failed');

        expect(rejection instanceof DeviceOfferRejectedError).toBe(true);
        expect(genuineFailure instanceof DeviceOfferRejectedError).toBe(false);
    });
});