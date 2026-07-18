import EventEmitter from 'events';
import DeviceManager, { DeviceInfo, DeviceManagerEvent } from '../deviceManager.js';
import Logger from '../../logging/Logger.js';
import { asyncHandler } from '../../util/async.js';
import { logError } from '../../util/error.js';
import { AnyDevice, DeviceEvent } from '../device.js';
import { DeviceId } from '../deviceId.js';

export type AnyDeviceProvider = DeviceProvider<DeviceInfo, AnyDevice>;

export default abstract class DeviceProvider<
    DI extends DeviceInfo,
    D extends AnyDevice
>
{
    protected readonly deviceManager: DeviceManager;

    protected readonly eventEmitter: EventEmitter;

    protected readonly logger: Logger;

    private readonly connectedDevices: Map<DeviceId, D> = new Map();

    private readonly deviceDetectedListener: (deviceInfo: DeviceInfo) => void;

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

    public async init(): Promise<void> {
        return Promise.resolve();
    }

    public async stop(): Promise<void> {
        this.stopped = true;

        this.deviceManager.off(DeviceManagerEvent.deviceDetected, this.deviceDetectedListener);

        for (const device of this.connectedDevices.values()) {
            await device.close();
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

    private async handleDeviceDetection(deviceInfo: DeviceInfo): Promise<void> {
        if (!this.supportsDeviceInfo(deviceInfo)) {
            return;
        }

        this.logger.debug(`Requesting to acquire device: ${deviceInfo.id}`);

        const acquireResult = await this.deviceManager.acquireDetectedDevice(deviceInfo.id);

        if (!acquireResult.successful) {
            this.logger.debug(`Could not acquire device: ${acquireResult.reason}`);
            return;
        }

        let device: D | undefined;

        try {
            device = await this.createDevice(deviceInfo);
        } catch (e: unknown) {
            logError(this.logger, `Error while connecting to device '${deviceInfo.id}'`, e);
            await this.abortDetection(deviceInfo);
            return;
        }

        if (undefined === device || this.stopped) {
            if (undefined !== device) {
                await device.close();
            }
            await this.abortDetection(deviceInfo);
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

    /**
     * Cleans up after a failed/aborted connection attempt. Transport-level cleanup runs *before*
     * the acquire claim is released, so the next provider in the queue cannot begin a new attempt
     * against a transport this provider is still tearing down.
     */
    private async abortDetection(deviceInfo: DI): Promise<void> {
        await this.onConnectFailed(deviceInfo);
        this.deviceManager.releaseDetectedDevice(deviceInfo.id);
    }

    protected abstract supportsDeviceInfo(deviceInfo: DeviceInfo): deviceInfo is DI;

    protected abstract createDevice(deviceInfo: DI): Promise<D | undefined>;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected async onConnectFailed(deviceInfo: DI): Promise<void> {
        return Promise.resolve();
    }
}
