import { CancellationToken, sequentialTaskQueueEvents, SequentialTaskQueue } from '@timesplinter/sequential-task-queue';
import { AnyDevice } from './device.js';
import { DeviceDetectionInfo } from './deviceManager.js';
import DeviceOfferRejectedError from './deviceOfferRejectedError.js';
import Logger from '../logging/Logger.js';
import { logError } from '../util/error.js';
import { DetectionId } from './deviceId.js';

export type OfferResult<D extends AnyDevice> =
    | { successful: true, device: D }
    | { successful: false, reason: unknown };

type DeviceOffer<D extends AnyDevice> = (cancellationToken: CancellationToken) => Promise<D | DeviceOfferRejectedError>;

export default class DetectedDeviceOfferQueue
{
    private readonly queues: Map<DetectionId, SequentialTaskQueue> = new Map();

    private readonly logger: Logger;

    public constructor(logger: Logger) {
        this.logger = logger;
    }

    private getOrCreateQueue(detectionId: DetectionId): SequentialTaskQueue
    {
        let queue = this.queues.get(detectionId);

        if (queue !== undefined) {
            return queue;
        }

        queue = new SequentialTaskQueue();

        queue.on(sequentialTaskQueueEvents.drained, () => {
            // A revoked (closed) queue must survive its own drain - it's kept around deliberately
            // as a tombstone so a late offer can still see it and reject itself.
            if (!queue.isClosed) {
                this.queues.delete(detectionId);
            }
        });

        this.queues.set(detectionId, queue);

        return queue;
    }

    public offer<D extends AnyDevice>(deviceDetectionInfo: DeviceDetectionInfo, deviceOffer: DeviceOffer<D>): Promise<OfferResult<D>>
    {
        const detectionId = deviceDetectionInfo.detectionId;
        const queue = this.getOrCreateQueue(detectionId);

        if (queue.isClosed) {
            return Promise.resolve({
                successful: false,
                reason: new DeviceOfferRejectedError('Device is not available anymore for offering'),
            });
        }

        const task = queue.push((cancellationToken: CancellationToken) => this.runOffer(deviceOffer, cancellationToken));

        return Promise.resolve(task.then(
            (result: OfferResult<D>): OfferResult<D> => {
                if (result.successful) {
                    // Reject every other still-queued offer for this detection id without them
                    // ever running, since this device has already been claimed.
                    this.close(detectionId, new DeviceOfferRejectedError('Device has been claimed by another provider'));
                }

                return result;
            },
            // Reached either if the offer was cancelled while still queued (never even starting -
            // our callback above never ran) or if deviceOffer() itself rejected/threw uncaught -
            // translate both the same way.
            (reason: unknown): OfferResult<D> => ({
                successful: false,
                reason: reason,
            })
        ));
    }

    private async runOffer<D extends AnyDevice>(
        deviceOffer: DeviceOffer<D>,
        cancellationToken: CancellationToken
    ): Promise<OfferResult<D>> {
        const device = await deviceOffer(cancellationToken);

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
            reason: cancellationToken.reason,
        };
    }

    /**
     * True if a queue currently exists for this detection id - either genuinely active/in-flight,
     * or a closed tombstone left behind by revoke(). Does not distinguish between the two;
     * callers that need "is a fresh announce still blocked by a past revoke" must call
     * dropIfRevoked() first.
     */
    public has(detectionId: DetectionId): boolean
    {
        return this.queues.has(detectionId);
    }

    public dropIfRevoked(detectionId: DetectionId): void
    {
        const queue = this.queues.get(detectionId);

        if (queue !== undefined && queue.isClosed) {
            this.queues.delete(detectionId);
        }
    }

    private close(detectionId: DetectionId, reason: DeviceOfferRejectedError): void
    {
        const queue = this.queues.get(detectionId);

        if (undefined !== queue) {
            void queue.close(true, reason);
        }

        this.queues.delete(detectionId);
    }

    public revoke(detectionId: DetectionId, reason: DeviceOfferRejectedError): void
    {
        const queue = this.getOrCreateQueue(detectionId);

        void queue.close(true, reason);
    }

    public closeAll(reason: DeviceOfferRejectedError): void
    {
        for (const detectionId of this.queues.keys()) {
            this.close(detectionId, reason);
        }
    }
}
