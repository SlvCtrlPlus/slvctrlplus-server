import EventEmitter from 'events';
import DeviceProvider from '../../provider/deviceProvider.js';
import Logger from '../../../logging/Logger.js';
import VirtualDevice from './virtualDevice.js';
import KnownDevice from '../../../settings/knownDevice.js';
import SettingsManager from '../../../settings/settingsManager.js';
import SettingsEventType from '../../../settings/settingsEventType.js';
import type Settings from '../../../settings/settings.js';
import Device, { DeviceEvent } from '../../device.js';
import VirtualDeviceFactory from './virtualDeviceFactory.js';
import DeviceManager, { DeviceInfo, DeviceManagerEvent } from '../../deviceManager.js';
import { asyncHandler } from '../../../util/async.js';
import { logError } from '../../../util/error.js';

export type VirtualDeviceInfo = DeviceInfo & {
    type: 'virtual';
    knownDevice: KnownDevice;
};

export default class VirtualDeviceProvider extends DeviceProvider
{
    public static readonly providerName = 'virtual';

    private connectedDevices: Map<string, VirtualDevice<any>> = new Map();

    private readonly deviceFactory: VirtualDeviceFactory;

    private readonly settingsManager: SettingsManager;

    private readonly settingsChangedListener: (settings: Settings) => void;

    private stopped: boolean = false;

    public constructor(
        deviceManager: DeviceManager,
        eventEmitter: EventEmitter,
        deviceFactory: VirtualDeviceFactory,
        settingsManager: SettingsManager,
        logger: Logger
    ) {
        super(deviceManager, eventEmitter, logger.child({ name: VirtualDeviceProvider.name }));
        this.deviceFactory = deviceFactory;
        this.settingsManager = settingsManager;

        this.deviceManager.on(
            DeviceManagerEvent.deviceDetected,
            asyncHandler(
                this.handleDeviceDetection.bind(this),
                (err: unknown) => logError(this.logger, 'Error in device detection handler', err)
            )
        );

        this.settingsChangedListener = asyncHandler(
            async (): Promise<void> => this.discoverVirtualDevices(),
            (e: unknown) => logError(this.logger, 'Error while scanning for virtual devices after a settings change', e)
        );
    }

    public override async init(): Promise<void> {
        this.stopped = false;

        this.settingsManager.on(SettingsEventType.changed, this.settingsChangedListener);

        // Load whatever is already configured once, without waiting for the first settings
        // change. Further additions/removals are picked up reactively via settingsChangedListener.
        await this.discoverVirtualDevices();
    }

    public override async stop(): Promise<void> {
        this.stopped = true;

        this.settingsManager.off(SettingsEventType.changed, this.settingsChangedListener);

        for (const device of this.connectedDevices.values()) {
            await this.removeDevice(device);
        }
    }

    /**
     * Virtual devices only exist as long as their known device is configured, unlike physical
     * devices where removing the known device entry just makes it "unknown" again (defaulting
     * back to enabled). That's a virtual-specific concern the device manager can't detect on its
     * own, so this still needs to be checked whenever settings change. Enabling/disabling an
     * already-configured device, on the other hand, is handled centrally by
     * `DeviceManager.onSettingsChanged()`.
     */
    private async discoverVirtualDevices(): Promise<void> {
        if (this.stopped) {
            return;
        }

        const settings = this.settingsManager.getSettings();

        if (undefined === settings) {
            // Settings not loaded yet
            return;
        }

        const virtualDevices = settings.getKnownDevicesBySource(VirtualDeviceProvider.providerName);

        // Check if devices have been removed from the configuration entirely
        for (const [k, v] of this.connectedDevices) {
            if (!virtualDevices.has(k)) {
                await this.removeDevice(v);
            }
        }

        // Announce all currently configured devices that aren't connected yet - the device
        // manager takes care of skipping disabled ones (and re-announcing them once re-enabled)
        // as well as ones already being connected.
        for (const [k, v] of virtualDevices) {
            if (this.stopped) {
                return;
            }

            if (this.connectedDevices.has(k)) {
                continue;
            }

            const deviceInfo: VirtualDeviceInfo = { type: 'virtual', id: v.id, knownDevice: v };

            this.deviceManager.announceDetectedDevice(deviceInfo);
        }
    }

    private isVirtualDeviceInfo(deviceInfo: DeviceInfo): deviceInfo is VirtualDeviceInfo {
        return deviceInfo.type === 'virtual';
    }

    private async handleDeviceDetection(deviceInfo: DeviceInfo): Promise<void> {
        if (!this.isVirtualDeviceInfo(deviceInfo)) {
            return;
        }

        const knownDevice = deviceInfo.knownDevice;

        this.logger.info(`Virtual device detected: ${knownDevice.name}`, knownDevice);

        const acquireResult = await this.deviceManager.acquireDetectedDevice(deviceInfo.id);

        if (!acquireResult.successful) {
            this.logger.debug(`Could not acquire device: ${acquireResult.reason}`);
            return;
        }

        try {
            const device = await this.deviceFactory.create(knownDevice, VirtualDeviceProvider.providerName);

            if (this.stopped) {
                await device.close();
                this.deviceManager.releaseDetectedDevice(deviceInfo.id);
                return;
            }

            // Keep local bookkeeping in sync regardless of what closes the device (e.g. the
            // device manager closing it right away because it has been disabled in the meantime).
            device.on(DeviceEvent.deviceDisconnected, (d) => this.connectedDevices.delete(d.getDeviceId));

            if (!this.deviceManager.addDevice(deviceInfo, device)) {
                // addDevice() has already closed it, released it from the acquire queue, and
                // registered it for retry once re-enabled.
                return;
            }

            this.connectedDevices.set(knownDevice.id, device);

            this.logger.info(`Connected virtual devices: ${this.connectedDevices.size}`);
        } catch (e: unknown) {
            logError(this.logger, `Could not initiate virtual device '${knownDevice.id}'`, e);
            this.deviceManager.releaseDetectedDevice(deviceInfo.id);
        }
    }

    private async removeDevice(device: Device): Promise<void> {
        const deviceId = device.getDeviceId;

        try {
            await device.close();
        } finally {
            this.connectedDevices.delete(deviceId);
        }

        this.logger.info(`Device removed: ${deviceId} (${device.getDeviceName})`);
        this.logger.info(`Connected virtual devices: ${this.connectedDevices.size}`);
    }
}
