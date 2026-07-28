import EventEmitter from 'events';
import DeviceManager, { DeviceDetectionInfo, DeviceManagerEvent } from '../deviceManager.js';
import DeviceOfferRejectedError from '../deviceOfferRejectedError.js';
import Logger from '../../logging/Logger.js';
import { asyncHandler } from '../../util/async.js';
import { logError } from '../../util/error.js';
import { AnyDevice, DeviceEvent } from '../device.js';
import { DeviceId } from '../deviceId.js';
import BaseError from 'modern-errors';

export type AnyDeviceProvider = DeviceProvider<DeviceDetectionInfo, AnyDevice>;

export default abstract class DeviceProvider<DDI extends DeviceDetectionInfo, D extends AnyDevice>
{
    protected readonly deviceManager: DeviceManager;

    protected readonly eventEmitter: EventEmitter;

    protected readonly logger: Logger;

    private readonly connectedDevices: Map<DeviceId, D> = new Map();

    private readonly deviceDetectedListener: (deviceDetectionInfo: DeviceDetectionInfo) => void;

    private running: boolean = false;

    protected constructor(deviceManager: DeviceManager, eventEmitter: EventEmitter, logger: Logger) {
        this.deviceManager = deviceManager;
        this.eventEmitter = eventEmitter;
        this.logger = logger;

        this.deviceDetectedListener = asyncHandler(
            this.handleDeviceDetection.bind(this),
            (err: unknown) => logError(this.logger, 'Error in device detection handler', err)
        );
    }

    public async start(): Promise<void> {
        // Providers support a full stop() -> start() restart cycle, not just the initial start
        if (!this.running) {
            this.deviceManager.on(DeviceManagerEvent.deviceDetected, this.deviceDetectedListener);
            this.running = true;
        }

        await this.doStart();
    }

    public async stop(): Promise<void> {
        // Flipped before doStop() so isStopped() reports the new state immediately, while the
        // previous value is kept around to decide whether the subscription needs to be dropped
        const wasRunning = this.running;
        this.running = false;

        try {
            await this.doStop();
        } catch (e: unknown) {
            logError(this.logger, 'Error while stopping device provider', e);
        }

        if (wasRunning) {
            this.deviceManager.off(DeviceManagerEvent.deviceDetected, this.deviceDetectedListener);
        }

        // A rejected close() must neither abort the loop nor leave stop() itself rejected
        for (const device of this.connectedDevices.values()) {
            try {
                await device.close();
            } catch (e: unknown) {
                logError(this.logger, `Failed to close device '${device.getDeviceId}' while stopping provider`, e);
            }
        }
        this.connectedDevices.clear();
    }

    /**
     * Runs on every start() call - subclasses whose start() is re-entered while already running
     * (e.g. a reconnect loop) are responsible for making their own logic here idempotent.
     */
    protected async doStart(): Promise<void> {
        // no-op default
    }

    /**
     * Runs before the base tears down its own subscription and closes connected devices.
     */
    protected async doStop(): Promise<void> {
        // no-op default
    }

    protected isStopped(): boolean {
        return !this.running;
    }

    protected getConnectedDevices(): IterableIterator<D> {
        return this.connectedDevices.values();
    }

    protected getConnectedDevice(deviceId: DeviceId): D | undefined {
        return this.connectedDevices.get(deviceId);
    }

    private async handleDeviceDetection(deviceDetectionInfo: DeviceDetectionInfo): Promise<void> {
        if (!this.canHandleDeviceDetectionInfo(deviceDetectionInfo)) {
            return;
        }

        this.logger.debug(`Requesting to acquire device: ${deviceDetectionInfo.detectionId}`);

        const result = await this.deviceManager.offerDevice(deviceDetectionInfo, async () => {
            const device = await this.createDevice(deviceDetectionInfo);

            if (undefined === device) {
                return undefined;
            }

            // Provider was stopped while the offer was in flight (or waiting in queue) - don't
            // hand a connected device to a stopped provider, treat it like a failed offer instead
            if (this.isStopped()) {
                try {
                    await device.close();
                } catch (e: unknown) {
                    logError(this.logger, `Failed to close device '${device.getDeviceId}' after provider was stopped`, e);
                }
                return undefined;
            }

            // Tracked here, before handing the device back to the manager, since addDevice()
            // emits deviceConnected synchronously as soon as this offer settles - our own
            // bookkeeping must already be in place by then for any listener of that event to see
            // consistent state. If the manager ends up rejecting the device anyway (e.g.
            // disabled), its own close() call fires deviceDisconnected, which the listener below
            // uses to roll this back.
            device.on(DeviceEvent.deviceDisconnected, (d) => {
                this.connectedDevices.delete(d.getDeviceId);
                this.logger.info(`Connected devices: ${this.connectedDevices.size}`);
            });
            this.connectedDevices.set(device.getDeviceId, device);
            this.logger.info(`Connected devices: ${this.connectedDevices.size}`);

            return device;
        });

        if (!result.successful) {
            this.logger.info(`Device offer for '${deviceDetectionInfo.detectionId}' was rejected: ${BaseError.normalize(result.reason).message}`);

            // Only a real connect failure (thrown/undefined offer) warrants provider cleanup -
            // manager-level rejections (disabled, claimed elsewhere, revoked, unavailable) don't
            if (!(result.reason instanceof DeviceOfferRejectedError)) {
                await this.onConnectFailed(deviceDetectionInfo);
            }
        }
    }

    protected abstract canHandleDeviceDetectionInfo(deviceDetectionInfo: DeviceDetectionInfo): deviceDetectionInfo is DDI;

    protected abstract createDevice(deviceDetectionInfo: DDI): Promise<D | undefined>;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected async onConnectFailed(deviceDetectionInfo: DDI): Promise<void> {
        return Promise.resolve();
    }
}
