import EventEmitter from 'events';
import DeviceManager, { DeviceDetectionInfo, DeviceManagerEvent } from '../deviceManager.js';
import Logger from '../../logging/Logger.js';
import { asyncHandler } from '../../util/async.js';
import { logError } from '../../util/error.js';
import { AnyDevice, DeviceEvent } from '../device.js';
import { DeviceId } from '../deviceId.js';

export type AnyDeviceProvider = DeviceProvider<DeviceDetectionInfo, AnyDevice>;

export default abstract class DeviceProvider<DDI extends DeviceDetectionInfo, D extends AnyDevice>
{
    protected readonly deviceManager: DeviceManager;

    protected readonly eventEmitter: EventEmitter;

    protected readonly logger: Logger;

    private readonly connectedDevices: Map<DeviceId, D> = new Map();

    private readonly deviceDetectedListener: (deviceInfo: DeviceDetectionInfo) => void;

    private stopped: boolean = false;

    protected constructor(deviceManager: DeviceManager, eventEmitter: EventEmitter, logger: Logger) {
        this.deviceManager = deviceManager;
        this.eventEmitter = eventEmitter;
        this.logger = logger;

        this.deviceDetectedListener = asyncHandler(
            this.handleDeviceDetection.bind(this),
            (err: unknown) => logError(this.logger, 'Error in device detection handler', err)
        );

        this.deviceManager.on(DeviceManagerEvent.deviceDetected, this.deviceDetectedListener);
    }

    public async start(): Promise<void> {
        return Promise.resolve();
    }

    public async stop(): Promise<void> {
        this.stopped = true;

        this.deviceManager.off(DeviceManagerEvent.deviceDetected, this.deviceDetectedListener);

        // A rejected close() must not abort the loop or leave stop() itself rejected: DeviceProviderManager
        // keeps a provider whose stop() throws around (assuming it may still be partially running), which
        // would make this instance permanently unusable - already stopped and detached above, yet never
        // replaced since the manager thinks a re-enable of this source doesn't need a fresh provider.
        for (const device of this.connectedDevices.values()) {
            try {
                await device.close();
            } catch (e: unknown) {
                logError(this.logger, `Failed to close device '${device.getDeviceId}' while stopping provider`, e);
            }
        }
        this.connectedDevices.clear();
    }

    protected isStopped(): boolean {
        return this.stopped;
    }

    protected getConnectedDevices(): IterableIterator<D> {
        return this.connectedDevices.values();
    }

    protected getConnectedDevice(deviceId: DeviceId): D | undefined {
        return this.connectedDevices.get(deviceId);
    }

    private async handleDeviceDetection(deviceInfo: DeviceDetectionInfo): Promise<void> {
        if (!this.canHandleDeviceDetectionInfo(deviceInfo)) {
            return;
        }

        this.logger.debug(`Requesting to acquire device: ${deviceInfo.detectionId}`);

        const acquireResult = await this.deviceManager.acquireDetectedDevice(deviceInfo.detectionId);

        if (!acquireResult.successful) {
            this.logger.debug(`Could not acquire device: ${acquireResult.reason}`);
            return;
        }

        let device: D | undefined;

        try {
            device = await this.createDevice(deviceInfo);
        } catch (e: unknown) {
            logError(this.logger, `Error while connecting to device '${deviceInfo.detectionId}'`, e);
            await this.abortDetection(deviceInfo);
            return;
        }

        if (undefined === device || this.stopped) {
            try {
                if (undefined !== device) {
                    await device.close();
                }
            } finally {
                await this.abortDetection(deviceInfo);
            }
            return;
        }

        device.on(DeviceEvent.deviceDisconnected, (d) => this.connectedDevices.delete(d.getDeviceId));

        if (!this.deviceManager.addDevice(deviceInfo, device)) {
            // The device has not been added by the device manager.
            // For example, it may be a disabled device.
            return;
        }

        this.connectedDevices.set(device.getDeviceId, device);

        this.logger.info(`Connected devices: ${this.connectedDevices.size}`);
    }

    private async abortDetection(deviceInfo: DDI): Promise<void> {
        try {
            await this.onConnectFailed(deviceInfo);
        } finally {
            this.deviceManager.releaseDetectedDevice(deviceInfo.detectionId);
        }
    }

    protected abstract canHandleDeviceDetectionInfo(deviceDetectionInfo: DeviceDetectionInfo): deviceDetectionInfo is DDI;

    protected abstract createDevice(deviceInfo: DDI): Promise<D | undefined>;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected async onConnectFailed(deviceInfo: DDI): Promise<void> {
        return Promise.resolve();
    }
}
