import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { EventEmitter } from 'events';
import DetectedDeviceOfferQueue from '../../../src/device/detectedDeviceOfferQueue.js';
import DeviceOfferRejectedError from '../../../src/device/deviceOfferRejectedError.js';
import { DeviceDetectionInfo } from '../../../src/device/deviceManager.js';
import { AnyDevice } from '../../../src/device/device.js';
import { DeviceId } from '../../../src/device/deviceId.js';
import Logger from '../../../src/logging/Logger.js';
import TestDevice from './testDevice.js';

describe('DetectedDeviceOfferQueue', () => {
    let mockedLogger: ReturnType<typeof mock<Logger>>;
    const deviceId = DeviceId.create('device-1');
    const deviceInfo: DeviceDetectionInfo = { type: 'test', detectionId: deviceId };

    beforeEach(() => {
        mockedLogger = mock<Logger>();
        mockedLogger.child.mockReturnValue(mockedLogger);
    });

    describe('has / open / discard', () => {
        it('reflects open() and discard()', () => {
            const queue = new DetectedDeviceOfferQueue(mockedLogger);

            expect(queue.has(deviceId)).toBe(false);

            queue.open(deviceId);
            expect(queue.has(deviceId)).toBe(true);

            queue.discard(deviceId);
            expect(queue.has(deviceId)).toBe(false);
        });
    });

    describe('offer', () => {
        it('rejects with DeviceOfferRejectedError when the queue does not exist', async () => {
            const queue = new DetectedDeviceOfferQueue(mockedLogger);

            const result = await queue.offer(deviceInfo, () => Promise.resolve(new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter())));

            expect(result.successful).toBe(false);
            expect(!result.successful && result.reason).toBeInstanceOf(DeviceOfferRejectedError);
        });

        it('runs the first offer immediately and resolves successfully when accepted', async () => {
            const queue = new DetectedDeviceOfferQueue(mockedLogger);
            queue.open(deviceId);

            const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());
            const result = await queue.offer(deviceInfo, () => Promise.resolve(device));

            expect(result).toStrictEqual({ successful: true, device });
        });

        it('does not run a second offer while the first is still pending', async () => {
            const queue = new DetectedDeviceOfferQueue(mockedLogger);
            queue.open(deviceId);

            let resolveFirstOffer!: (device: AnyDevice) => void;
            const firstOfferPromise = new Promise<AnyDevice>((resolve) => { resolveFirstOffer = resolve; });
            const secondOfferFn = vi.fn(() => Promise.resolve(new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter())));

            const firstResultPromise = queue.offer(deviceInfo, () => firstOfferPromise);
            queue.offer(deviceInfo, secondOfferFn);

            expect(secondOfferFn).not.toHaveBeenCalled();

            resolveFirstOffer(new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter()));
            await firstResultPromise;
        });

        it('hands off to the next queued offer when the first one throws', async () => {
            const queue = new DetectedDeviceOfferQueue(mockedLogger);
            queue.open(deviceId);

            const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());
            const offerError = new Error('connection failed');

            const firstResultPromise = queue.offer(deviceInfo, () => Promise.reject(offerError));
            const secondResultPromise = queue.offer(deviceInfo, () => Promise.resolve(device));

            const [firstResult, secondResult] = await Promise.all([firstResultPromise, secondResultPromise]);

            expect(firstResult).toStrictEqual({ successful: false, reason: offerError });
            expect(secondResult).toStrictEqual({ successful: true, device });
        });

        it('hands off to the next queued offer when the first device is rejected', async () => {
            const rejection = new DeviceOfferRejectedError('rejected');
            const secondDevice = new TestDevice(DeviceId.create('device-1-second'), 'Foo', new Date(), false, new EventEmitter());

            const queue = new DetectedDeviceOfferQueue(mockedLogger);
            queue.open(deviceId);

            const firstResultPromise = queue.offer(deviceInfo, () => Promise.resolve(rejection));
            const secondResultPromise = queue.offer(deviceInfo, () => Promise.resolve(secondDevice));

            const [firstResult, secondResult] = await Promise.all([firstResultPromise, secondResultPromise]);

            expect(firstResult).toStrictEqual({ successful: false, reason: rejection });
            expect(secondResult).toStrictEqual({ successful: true, device: secondDevice });
        });

        it('reopens for a new offer after the only queued offer is rejected', async () => {
            const queue = new DetectedDeviceOfferQueue(mockedLogger);
            queue.open(deviceId);

            await queue.offer(deviceInfo, () => Promise.resolve(new DeviceOfferRejectedError('rejected')));

            expect(queue.has(deviceId)).toBe(false);

            queue.open(deviceId);
            expect(queue.has(deviceId)).toBe(true);
        });

        it('rejects other queued offers with DeviceOfferRejectedError once a device is claimed', async () => {
            const queue = new DetectedDeviceOfferQueue(mockedLogger);
            queue.open(deviceId);

            let resolveFirstOffer!: (device: AnyDevice) => void;
            const firstOfferPromise = new Promise<AnyDevice>((resolve) => { resolveFirstOffer = resolve; });
            const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());

            const firstResultPromise = queue.offer(deviceInfo, () => firstOfferPromise);
            const secondResultPromise = queue.offer(deviceInfo, () => Promise.reject(new Error('should never run')));

            resolveFirstOffer(device);

            const [firstResult, secondResult] = await Promise.all([firstResultPromise, secondResultPromise]);

            expect(firstResult).toStrictEqual({ successful: true, device });
            expect(secondResult.successful).toBe(false);
            expect(!secondResult.successful && secondResult.reason).toBeInstanceOf(DeviceOfferRejectedError);
        });
    });

    describe('clear', () => {
        it('resolves a pending offer with failure', async () => {
            const queue = new DetectedDeviceOfferQueue(mockedLogger);
            queue.open(deviceId);

            // First offer never settles on its own, so it's still holding the queue when cleared
            const pendingPromise = queue.offer(deviceInfo, () => new Promise<AnyDevice>(() => {}));

            queue.clear(deviceId, 'revoked');

            const result = await pendingPromise;
            expect(result.successful).toBe(false);
            expect(!result.successful && result.reason).toBeInstanceOf(DeviceOfferRejectedError);
        });

        it('closes a device whose offer resolves after the queue was cleared, without accepting it', async () => {
            const queue = new DetectedDeviceOfferQueue(mockedLogger);
            queue.open(deviceId);

            let resolveOffer!: (device: AnyDevice) => void;
            const offerPromise = new Promise<AnyDevice>((resolve) => { resolveOffer = resolve; });
            let offerStarted = false;
            const resultPromise = queue.offer(deviceInfo, () => {
                offerStarted = true;
                return offerPromise;
            });

            // Wait for the offer to actually start running (SequentialTaskQueue starts tasks via
            // its scheduler, not synchronously) before clearing, to genuinely simulate a revoke
            // while the offer is in flight rather than while it's still merely queued.
            await vi.waitFor(() => expect(offerStarted).toBe(true));

            // Device physically disappears while the offer is still in flight.
            queue.clear(deviceId, 'revoked');

            const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());
            const closeSpy = vi.spyOn(device, 'close');

            // The offer only settles now, after the queue was already cleared - the caller
            // already got a rejected result above, so this device must never be accepted.
            resolveOffer(device);

            const result = await resultPromise;
            expect(result.successful).toBe(false);
            expect(!result.successful && result.reason).toBeInstanceOf(DeviceOfferRejectedError);

            await vi.waitFor(() => expect(closeSpy).toHaveBeenCalled());
        });

        it('does not corrupt a fresh, still-pending queue when a stale offer fails after a clear', async () => {
            const queue = new DetectedDeviceOfferQueue(mockedLogger);
            queue.open(deviceId);

            let rejectStaleOffer!: (reason: unknown) => void;
            const staleOfferPromise = new Promise<AnyDevice>((_resolve, reject) => { rejectStaleOffer = reject; });
            let staleOfferStarted = false;
            const staleResultPromise = queue.offer(deviceInfo, () => {
                staleOfferStarted = true;
                return staleOfferPromise;
            });

            // Wait for the stale offer to actually start running before clearing, to genuinely
            // simulate a revoke while it's in flight rather than while it's still merely queued.
            await vi.waitFor(() => expect(staleOfferStarted).toBe(true));

            // Device physically disappears while the stale offer is still in flight.
            queue.clear(deviceId, 'revoked');

            // Re-opened under the same detection id (e.g. redetected) - a fresh queue now
            // exists, with its own still-pending offer.
            queue.open(deviceId);

            let resolveFreshOffer!: (device: AnyDevice) => void;
            const freshOfferPromise = new Promise<AnyDevice>((resolve) => { resolveFreshOffer = resolve; });
            const freshResultPromise = queue.offer(deviceInfo, () => freshOfferPromise);

            // The stale offer only fails now, well after it was cleared and superseded - while
            // the fresh offer is still pending. Without the staleness guard, this would
            // incorrectly wipe the still-valid, currently in-flight fresh queue.
            rejectStaleOffer(new Error('stale offer failed'));
            await staleResultPromise;

            // A second offer for the same detection id right now must still be queued up behind
            // the fresh offer, not told the device is unavailable (which is what would happen if
            // the stale processing had wrongly wiped the still-valid queue).
            const secondResultPromise = queue.offer(deviceInfo, () => Promise.reject(new Error('should never run')));

            const freshDevice = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());
            resolveFreshOffer(freshDevice);

            const [freshResult, secondResult] = await Promise.all([freshResultPromise, secondResultPromise]);

            expect(freshResult).toStrictEqual({ successful: true, device: freshDevice });
            expect(secondResult.successful).toBe(false);
            // Specifically "claimed by another provider" (queued behind the still-valid fresh
            // queue) - not "not available anymore for offering", which would mean the queue was
            // wrongly wiped by the stale processing.
            expect(!secondResult.successful && (secondResult.reason as Error).message).toContain('claimed by another provider');
        });
    });

    describe('clearAll', () => {
        it('clears every open queue', async () => {
            const queue = new DetectedDeviceOfferQueue(mockedLogger);
            const otherDeviceId = DeviceId.create('device-2');

            queue.open(deviceId);
            queue.open(otherDeviceId);

            const firstResultPromise = queue.offer(deviceInfo, () => new Promise<AnyDevice>(() => {}));
            const secondResultPromise = queue.offer({ type: 'test', detectionId: otherDeviceId }, () => new Promise<AnyDevice>(() => {}));

            queue.clearAll('reset');

            const [firstResult, secondResult] = await Promise.all([firstResultPromise, secondResultPromise]);

            expect(firstResult.successful).toBe(false);
            expect(secondResult.successful).toBe(false);
            expect(queue.has(deviceId)).toBe(false);
            expect(queue.has(otherDeviceId)).toBe(false);
        });
    });
});
