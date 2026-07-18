import EventEmitter from 'events';
import DeviceProvider from './deviceProvider.js';
import DeviceManager, { DeviceInfo, DeviceManagerEvent } from '../deviceManager.js';
import Logger from '../../logging/Logger.js';
import { asyncHandler } from '../../util/async.js';
import { logError } from '../../util/error.js';
import { AnyDevice, DeviceEvent } from '../device.js';
import { DeviceId } from '../deviceId.js';

/**
 * Base class for providers that discover devices through the device manager's detection pipeline
 * (`announceDetectedDevice` -> `deviceDetected` -> acquire -> add). It owns the common flow so
 * subclasses only have to say which `DeviceInfo` they handle and how to turn it into a `Device`:
 *
 * 1. filter the `deviceDetected` event to the infos this provider handles (`supportsDeviceInfo`)
 * 2. acquire the device from the manager (losing the race to another provider is fine)
 * 3. create the actual device (`createDevice`) - the one genuinely provider-specific step
 * 4. hand it to `DeviceManager.addDevice()`, which owns the enabled/disabled decision and all the
 * acquire-queue bookkeeping (claim on success, release + retry on rejection)
 *
 * Connected devices are tracked locally (keyed by their final `getDeviceId`) so `stop()` can close
 * exactly the devices this provider owns, and are removed again automatically on disconnect.
 */
export default abstract class DetectedDeviceProvider<
    DI extends DeviceInfo,
    D extends AnyDevice = AnyDevice
> extends DeviceProvider
{
    private readonly connectedDevices: Map<DeviceId, D> = new Map();

    private readonly deviceDetectedListener: (deviceInfo: DeviceInfo) => void;

    // Removing the `deviceDetected` listener only blocks *new* detections; a `handleDeviceDetection`
    // call already awaiting acquisition/creation can still complete after `stop()`. This flag lets
    // that in-flight handler bail out and clean up instead of registering a device on a stopped
    // provider. Subclasses may read it (via `isStopped()`) to guard their own async work.
    private stopped: boolean = false;

    protected isStopped(): boolean {
        return this.stopped;
    }

    protected constructor(deviceManager: DeviceManager, eventEmitter: EventEmitter, logger: Logger) {
        super(deviceManager, eventEmitter, logger);

        this.deviceDetectedListener = asyncHandler(
            this.handleDeviceDetection.bind(this),
            (err: unknown) => logError(this.logger, 'Error in device detection handler', err)
        );

        this.deviceManager.on(DeviceManagerEvent.deviceDetected, this.deviceDetectedListener);
    }

    public override async stop(): Promise<void> {
        this.stopped = true;

        this.deviceManager.off(DeviceManagerEvent.deviceDetected, this.deviceDetectedListener);

        for (const device of this.connectedDevices.values()) {
            await device.close();
        }
        this.connectedDevices.clear();
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

        // The provider may have been stopped while `createDevice` was in flight. Don't register a
        // device on a stopped provider - close it and release the claim instead.
        if (undefined === device || this.stopped) {
            if (undefined !== device) {
                await device.close();
            }
            await this.abortDetection(deviceInfo);
            return;
        }

        // Keep local bookkeeping in sync regardless of what closes the device, e.g. the device
        // manager closing it right away because it turned out to belong to a disabled device.
        device.on(DeviceEvent.deviceDisconnected, (d) => this.connectedDevices.delete(d.getDeviceId));

        if (!this.deviceManager.addDevice(deviceInfo, device)) {
            // The device's final id (only known after connecting) belongs to a disabled known
            // device - addDevice() has already closed it, released it from the acquire queue, and
            // registered it for retry once re-enabled.
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

    /**
     * Type guard selecting the `DeviceInfo`s this provider is responsible for. Detection events
     * for infos of other providers are ignored.
     */
    protected abstract supportsDeviceInfo(deviceInfo: DeviceInfo): deviceInfo is DI;

    /**
     * Turns a detected device info into an actual connected `Device`, or `undefined` if it could
     * not be connected/identified (e.g. a failed handshake). Throwing is also allowed and treated
     * the same as returning `undefined`, additionally invoking `onConnectFailed()`.
     */
    protected abstract createDevice(deviceInfo: DI): Promise<D | undefined>;

    /**
     * Called after a failed or aborted connection attempt so subclasses can release any
     * transport-level resources they hold (e.g. disconnecting a BLE peripheral). No-op by default.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected async onConnectFailed(deviceInfo: DI): Promise<void> {
        return Promise.resolve();
    }
}
