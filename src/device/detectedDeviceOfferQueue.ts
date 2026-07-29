import { CancellationToken, cancellationTokenReasons, sequentialTaskQueueEvents, SequentialTaskQueue } from 'sequential-task-queue';
import { AnyDevice } from './device.js';
import { DeviceDetectionInfo } from './deviceManager.js';
import DeviceOfferRejectedError from './deviceOfferRejectedError.js';
import Logger from '../logging/Logger.js';
import { logError } from '../util/error.js';

export type OfferResult<D extends AnyDevice> =
    | { successful: true, device: D }
    | { successful: false, reason: unknown };

type DeviceOffer<D extends AnyDevice> = () => Promise<D | DeviceOfferRejectedError>;

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

        queue.on(sequentialTaskQueueEvents.drained, () => {
            if (this.queues.get(detectionId) === queue) {
                this.queues.delete(detectionId);
            }
        });

        this.queues.set(detectionId, queue);
        this.clearReasons.delete(detectionId);
    }

    public discard(detectionId: string): void
    {
        this.queues.delete(detectionId);
    }

    public offer<D extends AnyDevice>(deviceDetectionInfo: DeviceDetectionInfo, deviceOffer: DeviceOffer<D>): Promise<OfferResult<D>>
    {
        const detectionId = deviceDetectionInfo.detectionId;
        const queue = this.queues.get(detectionId);

        if (undefined === queue) {
            return Promise.resolve({ successful: false, reason: new DeviceOfferRejectedError(`Device with id '${detectionId}' is not available anymore for offering`) });
        }

        const task = queue.push((cancellationToken: CancellationToken) => this.runOffer(deviceOffer, detectionId, cancellationToken));

        return Promise.resolve(task.then(
            (result: OfferResult<D>): OfferResult<D> => {
                if (result.successful) {
                    // Reject every other still-queued offer for this detection id without
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

    private async runOffer<D extends AnyDevice>(
        deviceOffer: DeviceOffer<D>,
        detectionId: string,
        cancellationToken: CancellationToken
    ): Promise<OfferResult<D>> {
        const device = await deviceOffer();

        if (device instanceof DeviceOfferRejectedError) {
            return { successful: false, reason: device };
        }

        if (true !== cancellationToken.cancelled) {
            return { successful: true, device };
        }

        // In case this offer lost the race against another offer: close the device and reject the offer with a meaningful reason.
        try {
            await device.close();
        } catch (e: unknown) {
            logError(this.logger, `Failed to close device '${device.getDeviceId}' offered after its queue was cleared`, e);
        }

        return {
            successful: false,
            reason: new DeviceOfferRejectedError(this.clearReasons.get(detectionId) ?? 'Device offer was cancelled'),
        };
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
