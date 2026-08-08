import type { DeviceDetectionInfo } from '../deviceManager.js';
import type DeviceManager from '../deviceManager.js';
import { DeviceManagerEvent } from '../deviceManager.js';
import DeviceOfferRejectedError from '../deviceOfferRejectedError.js';
import type Logger from '../../logging/Logger.js';
import { asyncHandler } from '../../util/async.js';
import { logError } from '../../util/error.js';
import type { AnyDevice } from '../device.js';
import { DeviceEvent } from '../device.js';
import type { DeviceId } from '../deviceId.js';
import BaseError from 'modern-errors';

export type AnyDeviceProvider = DeviceProvider<DeviceDetectionInfo, AnyDevice>;

export default abstract class DeviceProvider<DDI extends DeviceDetectionInfo, D extends AnyDevice>
{
    protected readonly deviceManager: DeviceManager;

    protected readonly logger: Logger;

    private readonly connectedDevices = new Map<DeviceId, D>();

    private readonly deviceDetectedListener: (deviceDetectionInfo: DeviceDetectionInfo) => void;

    private running = false;

    protected constructor(deviceManager: DeviceManager, logger: Logger) {
        this.deviceManager = deviceManager;
        this.logger = logger;

        this.deviceDetectedListener = asyncHandler(
            this.handleDeviceDetection.bind(this),
            (err: unknown) => logError(this.logger, 'Error in device detection handler', err),
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
    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    protected async doStart(): Promise<void> {
        // no-op default
    }

    /**
     * Runs before the base tears down its own subscription and closes connected devices.
     */
    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/class-methods-use-this
    protected async onConnectFailed(deviceDetectionInfo: DDI): Promise<void> {
        return Promise.resolve();
    }

    protected abstract canHandleDeviceDetectionInfo(deviceDetectionInfo: DeviceDetectionInfo): deviceDetectionInfo is DDI;

    protected abstract createDevice(deviceDetectionInfo: DDI): Promise<D>;

    private async handleDeviceDetection(deviceDetectionInfo: DeviceDetectionInfo): Promise<void> {
        if (!this.canHandleDeviceDetectionInfo(deviceDetectionInfo)) {
            return;
        }

        this.logger.debug(`Requesting to offer device: ${deviceDetectionInfo.detectionId}`);

        const result = await this.deviceManager.offerDevice(deviceDetectionInfo, async () => this.createAndRegisterDevice(deviceDetectionInfo));

        if (!result.successful) {
            if (result.reason instanceof DeviceOfferRejectedError) {
                this.logger.info(`Offer for device detection with id '${deviceDetectionInfo.detectionId}' was rejected: ${result.reason.message}`);
            } else {
                this.logger.info(`Offer for device detection with id '${deviceDetectionInfo.detectionId}' failed: ${BaseError.normalize(result.reason).message}`);

                // Only a real connect failure (a thrown offer) warrants provider cleanup
                await this.onConnectFailed(deviceDetectionInfo);
            }
        }
    }

    private async createAndRegisterDevice(deviceDetectionInfo: DDI): Promise<D>
    {
        const device = await this.createDevice(deviceDetectionInfo);

        // Provider was stopped while the offer was in flight
        if (this.isStopped()) {
            try {
                await device.close();
            } catch (e: unknown) {
                logError(this.logger, `Failed to close device '${device.getDeviceId}' after provider was stopped`, e);
            }
            throw new Error(`Provider was stopped while connecting device '${deviceDetectionInfo.detectionId}'`);
        }

        device.on(DeviceEvent.deviceDisconnected, d => {
            this.connectedDevices.delete(d.getDeviceId);
            this.logger.info(`Connected devices: ${this.connectedDevices.size}`);
        });

        this.connectedDevices.set(device.getDeviceId, device);
        this.logger.info(`Connected devices: ${this.connectedDevices.size}`);

        return device;
    }
}
