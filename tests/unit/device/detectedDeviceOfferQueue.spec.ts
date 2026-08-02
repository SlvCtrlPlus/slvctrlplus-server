import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { EventEmitter } from 'events';
import DetectedDeviceOfferQueue from '../../../src/device/detectedDeviceOfferQueue.js';
import DeviceOfferRejectedError from '../../../src/device/deviceOfferRejectedError.js';
import { DeviceDetectionInfo } from '../../../src/device/deviceManager.js';
import { AnyDevice } from '../../../src/device/device.js';
import { DeviceId, DetectionId } from '../../../src/device/deviceId.js';
import Logger from '../../../src/logging/Logger.js';
import TestDevice from './testDevice.js';

describe('DetectedDeviceOfferQueue', () => {
    let mockedLogger: ReturnType<typeof mock<Logger>>;
    const detectionId = DetectionId.create('device-1');
    const deviceId = DeviceId.fromDetectionId(detectionId);
    const deviceInfo: DeviceDetectionInfo = { type: 'test', detectionId };

    beforeEach(() => {
        mockedLogger = mock<Logger>();
        mockedLogger.child.mockReturnValue(mockedLogger);
    });

    describe('has', () => {
        it('is false before any offer and true while one is pending', async () => {
            const queue = new DetectedDeviceOfferQueue(mockedLogger);

            expect(queue.has(detectionId)).toBe(false);

            const pendingPromise = queue.offer(deviceInfo, () => new Promise<AnyDevice>(() => {}));

            await vi.waitFor(() => expect(queue.has(detectionId)).toBe(true));

            queue.closeAll(new DeviceOfferRejectedError('test cleanup'));
            await pendingPromise;
        });
    });

    describe('offer', () => {
        it('lazily opens a queue and runs the offer even without any prior activity for the detection id', async () => {
            const queue = new DetectedDeviceOfferQueue(mockedLogger);
            const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());

            const result = await queue.offer(deviceInfo, () => Promise.resolve(device));

            expect(result).toStrictEqual({ successful: true, device });
        });

        it('does not run a second offer while the first is still pending', async () => {
            const queue = new DetectedDeviceOfferQueue(mockedLogger);

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

            const firstResultPromise = queue.offer(deviceInfo, () => Promise.resolve(rejection));
            const secondResultPromise = queue.offer(deviceInfo, () => Promise.resolve(secondDevice));

            const [firstResult, secondResult] = await Promise.all([firstResultPromise, secondResultPromise]);

            expect(firstResult).toStrictEqual({ successful: false, reason: rejection });
            expect(secondResult).toStrictEqual({ successful: true, device: secondDevice });
        });

        it('lazily reopens for a new offer after the only queued offer is rejected', async () => {
            const queue = new DetectedDeviceOfferQueue(mockedLogger);

            await queue.offer(deviceInfo, () => Promise.resolve(new DeviceOfferRejectedError('rejected')));

            expect(queue.has(detectionId)).toBe(false);

            const pendingPromise = queue.offer(deviceInfo, () => new Promise<AnyDevice>(() => {}));
            expect(queue.has(detectionId)).toBe(true);

            queue.closeAll(new DeviceOfferRejectedError('test cleanup'));
            await pendingPromise;
        });

        it('rejects other queued offers with DeviceOfferRejectedError once a device is claimed', async () => {
            const queue = new DetectedDeviceOfferQueue(mockedLogger);

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

    describe('closeAll', () => {
        // closeAll() replaces clear()'s narrower "just this one id" purpose - these exercise the
        // same underlying close()/cancel() mechanics, scoped to a single queue at a time.

        it('resolves a pending offer with failure', async () => {
            const queue = new DetectedDeviceOfferQueue(mockedLogger);

            // First offer never settles on its own, so it's still holding the queue when closed
            const pendingPromise = queue.offer(deviceInfo, () => new Promise<AnyDevice>(() => {}));

            queue.closeAll(new DeviceOfferRejectedError('revoked'));

            const result = await pendingPromise;
            expect(result.successful).toBe(false);
            expect(!result.successful && result.reason).toBeInstanceOf(DeviceOfferRejectedError);
        });

        it('closes a device whose offer resolves after the queue was cleared, without accepting it', async () => {
            const queue = new DetectedDeviceOfferQueue(mockedLogger);

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
            queue.closeAll(new DeviceOfferRejectedError('revoked'));

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
            queue.closeAll(new DeviceOfferRejectedError('revoked'));

            // Re-detected under the same detection id - offer() lazily opens a fresh queue, with
            // its own still-pending offer.
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

        it('closes every open queue', async () => {
            const queue = new DetectedDeviceOfferQueue(mockedLogger);
            const otherDetectionId = DetectionId.create('device-2');

            const firstResultPromise = queue.offer(deviceInfo, () => new Promise<AnyDevice>(() => {}));
            const secondResultPromise = queue.offer({ type: 'test', detectionId: otherDetectionId }, () => new Promise<AnyDevice>(() => {}));

            queue.closeAll(new DeviceOfferRejectedError('reset'));

            const [firstResult, secondResult] = await Promise.all([firstResultPromise, secondResultPromise]);

            expect(firstResult.successful).toBe(false);
            expect(secondResult.successful).toBe(false);
            expect(queue.has(detectionId)).toBe(false);
            expect(queue.has(otherDetectionId)).toBe(false);
        });
    });

    describe('revoke / dropIfRevoked', () => {
        it('blocks a subsequent offer even when nothing was ever offered before the revoke', async () => {
            const queue = new DetectedDeviceOfferQueue(mockedLogger);

            queue.revoke(detectionId, new DeviceOfferRejectedError('device disappeared'));

            const result = await queue.offer(deviceInfo, () => Promise.reject(new Error('should never run')));

            expect(result.successful).toBe(false);
            expect(!result.successful && result.reason).toBeInstanceOf(DeviceOfferRejectedError);
        });

        it('cancels an in-flight offer and keeps rejecting further offers after the revoke', async () => {
            const queue = new DetectedDeviceOfferQueue(mockedLogger);

            let offerStarted = false;
            const resultPromise = queue.offer(deviceInfo, () => {
                offerStarted = true;
                return new Promise<AnyDevice>(() => {});
            });

            await vi.waitFor(() => expect(offerStarted).toBe(true));

            queue.revoke(detectionId, new DeviceOfferRejectedError('device disappeared'));

            const result = await resultPromise;
            expect(result.successful).toBe(false);

            // The tombstone must survive the drain triggered by the revoke's own cancellation -
            // a late offer arriving right after must still see it and reject itself, instead of
            // unknowingly reopening a queue for a device that's already confirmed gone.
            const lateResult = await queue.offer(deviceInfo, () => Promise.reject(new Error('should never run')));

            expect(lateResult.successful).toBe(false);
            expect(!lateResult.successful && lateResult.reason).toBeInstanceOf(DeviceOfferRejectedError);
        });

        it('allows a fresh offer to succeed again once dropIfRevoked acknowledges a genuine redetection', async () => {
            const queue = new DetectedDeviceOfferQueue(mockedLogger);

            queue.revoke(detectionId, new DeviceOfferRejectedError('device disappeared'));
            queue.dropIfRevoked(detectionId);

            const device = new TestDevice(deviceId, 'Foo', new Date(), false, new EventEmitter());
            const result = await queue.offer(deviceInfo, () => Promise.resolve(device));

            expect(result).toStrictEqual({ successful: true, device });
        });

        it('dropIfRevoked is a no-op when there is nothing to drop', () => {
            const queue = new DetectedDeviceOfferQueue(mockedLogger);

            expect(() => queue.dropIfRevoked(detectionId)).not.toThrow();
            expect(queue.has(detectionId)).toBe(false);
        });
    });
});
