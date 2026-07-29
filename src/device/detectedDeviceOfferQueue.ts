import { AnyDevice } from './device.js';
import { DeviceDetectionInfo } from './deviceManager.js';
import DeviceOfferRejectedError from './deviceOfferRejectedError.js';
import Logger from '../logging/Logger.js';
import { logError } from '../util/error.js';

export type OfferResult<D extends AnyDevice> =
    | { successful: true, device: D }
    | { successful: false, reason: unknown };

/**
 * Decides whether a device offered through the queue is actually accepted (e.g. registered in
 * the device registry). Returns `undefined` on acceptance, or the rejection reason otherwise.
 */
export type DeviceOfferAcceptor = (deviceDetectionInfo: DeviceDetectionInfo, device: AnyDevice) => DeviceOfferRejectedError | undefined;

type PendingDetectedDeviceOffer<D extends AnyDevice> = {
    deviceDetectionInfo: DeviceDetectionInfo;
    deviceOffer: () => Promise<D>;
    resolve: (result: OfferResult<D>) => void;
};

/**
 * Serializes competing offers for the same detected device (e.g. multiple protocol providers
 * racing to claim the same serial port) into one queue per detection id, running one offer at a
 * time and handing the result to an injected acceptor to decide success or failure.
 */
export default class DetectedDeviceOfferQueue
{
    private readonly queues: Map<string, PendingDetectedDeviceOffer<any>[]> = new Map();

    private readonly accept: DeviceOfferAcceptor;

    private readonly logger: Logger;

    public constructor(accept: DeviceOfferAcceptor, logger: Logger) {
        this.accept = accept;
        this.logger = logger;
    }

    public has(detectionId: string): boolean
    {
        return this.queues.has(detectionId);
    }

    public open(detectionId: string): void
    {
        this.queues.set(detectionId, []);
    }

    public discard(detectionId: string): void
    {
        this.queues.delete(detectionId);
    }

    public offer<D extends AnyDevice>(deviceDetectionInfo: DeviceDetectionInfo, deviceOffer: () => Promise<D>): Promise<OfferResult<D>>
    {
        return new Promise<OfferResult<D>>((resolve) => {
            const deviceQueue = this.queues.get(deviceDetectionInfo.detectionId);

            if (undefined === deviceQueue) {
                resolve({ successful: false, reason: new DeviceOfferRejectedError(`Device with id '${deviceDetectionInfo.detectionId}' is not available anymore for offering`) });
                return;
            }

            // Always add to queue first
            deviceQueue.push({ deviceDetectionInfo, deviceOffer, resolve });

            // If we're first in line, run our offer immediately
            if (deviceQueue.length === 1) {
                void this.runNextOfferInQueue(deviceQueue);
            }
        });
    }

    public clear(detectionId: string, reason: string): void
    {
        for (const entry of this.queues.get(detectionId) ?? []) {
            entry.resolve({ successful: false, reason: new DeviceOfferRejectedError(reason) });
        }

        this.queues.delete(detectionId);
    }

    public clearAll(reason: string): void
    {
        for (const [detectionId] of this.queues) {
            this.clear(detectionId, reason);
        }
    }

    private async runNextOfferInQueue<D extends AnyDevice>(deviceQueue: PendingDetectedDeviceOffer<D>[]): Promise<void>
    {
        const entry = deviceQueue[0];

        if (undefined === entry) {
            return;
        }

        const detectionId = entry.deviceDetectionInfo.detectionId;

        try {
            const device = await entry.deviceOffer();

            // The queue may have been cleared (revoke/reset) or replaced (a fresh announce for
            // the same detection id) while this offer was in flight - the caller already got a
            // settled result for the old queue, so don't hand it a device it never asked for.
            if (this.queues.get(detectionId) !== deviceQueue) {
                await device.close()
                    .catch((e: unknown) => logError(this.logger, `Failed to close device '${device.getDeviceId}' offered after its queue was cleared`, e));
                return;
            }

            const rejection = this.accept(entry.deviceDetectionInfo, device);

            if (undefined === rejection) {
                entry.resolve({ successful: true, device });
                this.clear(detectionId, `Device '${detectionId}' has been claimed by another provider`);
                return;
            }

            this.rejectCurrentOfferInQueueAndAdvance(detectionId, deviceQueue, rejection);
        } catch (e: unknown) {
            this.rejectCurrentOfferInQueueAndAdvance(detectionId, deviceQueue, e);
        }
    }

    /**
     * Resolves the queue's head entry with the given failure reason, then hands off to the next
     * waiter, if any. Deletes the queue entirely once empty so the device can be re-announced
     * (DeviceManager.announceDetectedDevice() gates on the queue existing).
     */
    private rejectCurrentOfferInQueueAndAdvance<D extends AnyDevice>(detectionId: string, deviceQueue: PendingDetectedDeviceOffer<D>[], reason: unknown): void
    {
        deviceQueue[0]?.resolve({ successful: false, reason });

        // The queue may already have been cleared/replaced (revoke, reset, or a fresh announce
        // for the same detection id) - don't shift/delete a queue we no longer own.
        if (this.queues.get(detectionId) !== deviceQueue) {
            return;
        }

        deviceQueue.shift();

        if (deviceQueue.length === 0) {
            this.queues.delete(detectionId);
            return;
        }

        void this.runNextOfferInQueue(deviceQueue);
    }
}
