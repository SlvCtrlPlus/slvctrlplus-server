import { CancellationToken, cancellationTokenReasons, sequentialTaskQueueEvents, SequentialTaskQueue } from 'sequential-task-queue';
import { AnyDevice } from './device.js';
import { DeviceDetectionInfo } from './deviceManager.js';
import DeviceOfferRejectedError from './deviceOfferRejectedError.js';
import Logger from '../logging/Logger.js';
import { logError } from '../util/error.js';

export type OfferResult<D extends AnyDevice> =
    | { successful: true, device: D }
    | { successful: false, reason: unknown };

export default class DetectedDeviceOfferQueue
{
    private readonly queues: Map<string, SequentialTaskQueue> = new Map();

    // The reason passed to the most recent clear()/clearAll() call for a detection id, so that
    // offers cancelled by it (which only carry a generic cancellationTokenReasons sentinel) can
    // still be resolved with a meaningful, specific reason.
    private readonly clearReasons: Map<string, string> = new Map();

    private readonly logger: Logger;

    public constructor(logger: Logger) {
        this.logger = logger;
    }

    public has(detectionId: string): boolean
    {
        return this.queues.has(detectionId);
    }

    public open(detectionId: string): void
    {
        if (this.queues.has(detectionId)) {
            return;
        }

        const queue = new SequentialTaskQueue();

        // Fires once the queue has processed every offer (successfully, by failure, or by
        // cancellation) and nothing else is pending - drop it so the detection id becomes
        // available for a fresh announce again (has() gates on the map key existing).
        queue.on(sequentialTaskQueueEvents.drained, () => this.queues.delete(detectionId));

        this.queues.set(detectionId, queue);
        this.clearReasons.delete(detectionId);
    }

    public discard(detectionId: string): void
    {
        this.queues.delete(detectionId);
    }

    public offer<D extends AnyDevice>(deviceDetectionInfo: DeviceDetectionInfo, deviceOffer: () => Promise<D | DeviceOfferRejectedError>): Promise<OfferResult<D>>
    {
        const detectionId = deviceDetectionInfo.detectionId;
        const queue = this.queues.get(detectionId);

        if (undefined === queue) {
            return Promise.resolve({ successful: false, reason: new DeviceOfferRejectedError(`Device with id '${detectionId}' is not available anymore for offering`) });
        }

        const task = queue.push(async (cancellationToken: CancellationToken): Promise<OfferResult<D>> => {
            const device = await deviceOffer();

            if (device instanceof DeviceOfferRejectedError) {
                return { successful: false, reason: device };
            }

            // The queue may have been cleared (revoke/reset) or replaced (a fresh announce for
            // the same detection id) while this offer was in flight - the caller already got a
            // settled result for it, so don't hand it a device it never asked for.
            if (true === cancellationToken.cancelled) {
                try {
                    await device.close();
                } catch (e: unknown) {
                    logError(this.logger, `Failed to close device '${device.getDeviceId}' offered after its queue was cleared`, e);
                }
                return { successful: false, reason: new DeviceOfferRejectedError(this.clearReasons.get(detectionId) ?? 'Device offer was cancelled') };
            }

            return { successful: true, device };
        });

        return Promise.resolve(task.then(
            (result: OfferResult<D>): OfferResult<D> => {
                if (result.successful) {
                    // Success - reject every other still-queued offer for this detection id without
                    // running them, and drop the queue so a fresh announce can happen later.
                    this.clear(detectionId, `Device '${detectionId}' has been claimed by another provider`);
                }

                return result;
            },
            // Only reached if the offer was cancelled while still queued, never even starting
            // (our callback above never ran at all) - translate the generic sentinel the same way.
            (reason: unknown): OfferResult<D> => ({
                successful: false,
                reason: (reason === cancellationTokenReasons.cancel || reason === cancellationTokenReasons.timeout)
                    ? new DeviceOfferRejectedError(this.clearReasons.get(detectionId) ?? 'Device offer was cancelled')
                    : reason,
            })
        ));
    }

    public clear(detectionId: string, reason: string): void
    {
        const queue = this.queues.get(detectionId);

        if (undefined !== queue) {
            this.clearReasons.set(detectionId, reason);
            void queue.cancel();
        }

        this.queues.delete(detectionId);
    }

    public clearAll(reason: string): void
    {
        for (const [detectionId] of this.queues) {
            this.clear(detectionId, reason);
        }
    }
}
