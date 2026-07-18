import EventEmitter from 'events';
import DeviceProvider from '../../provider/deviceProvider.js';
import Logger from '../../../logging/Logger.js';
import VirtualDevice from './virtualDevice.js';
import KnownDevice from '../../../settings/knownDevice.js';
import SettingsManager from '../../../settings/settingsManager.js';
import SettingsEventType from '../../../settings/settingsEventType.js';
import type Settings from '../../../settings/settings.js';
import { DeviceInfo } from '../../deviceManager.js';
import VirtualDeviceFactory from './virtualDeviceFactory.js';
import DeviceManager from '../../deviceManager.js';
import { asyncHandler } from '../../../util/async.js';
import { logError } from '../../../util/error.js';

export type VirtualDeviceInfo = DeviceInfo & {
    type: 'virtual';
    knownDevice: KnownDevice;
};

export default class VirtualDeviceProvider extends DeviceProvider<VirtualDeviceInfo, VirtualDevice<any>>
{
    public static readonly providerName = 'virtual';

    private readonly deviceFactory: VirtualDeviceFactory;

    private readonly settingsManager: SettingsManager;

    private readonly settingsChangedListener: (settings: Settings) => void;

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

        this.settingsChangedListener = asyncHandler(
            async (): Promise<void> => this.discoverVirtualDevices(),
            (e: unknown) => logError(this.logger, 'Error while scanning for virtual devices after a settings change', e)
        );
    }

    public override async init(): Promise<void> {
        this.settingsManager.on(SettingsEventType.changed, this.settingsChangedListener);

        // Load whatever is already configured once, without waiting for the first settings
        // change. Further additions/removals are picked up reactively via settingsChangedListener.
        await this.discoverVirtualDevices();
    }

    public override async stop(): Promise<void> {
        this.settingsManager.off(SettingsEventType.changed, this.settingsChangedListener);

        // Detaches the detection listener and closes/clears the connected devices.
        await super.stop();
    }

    protected override supportsDeviceInfo(deviceInfo: DeviceInfo): deviceInfo is VirtualDeviceInfo {
        return deviceInfo.type === 'virtual';
    }

    protected override createDevice(deviceInfo: VirtualDeviceInfo): Promise<VirtualDevice<any> | undefined> {
        this.logger.info(`Virtual device detected: ${deviceInfo.knownDevice.name}`, deviceInfo.knownDevice);

        return this.deviceFactory.create(deviceInfo.knownDevice, VirtualDeviceProvider.providerName);
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
        const settings = this.settingsManager.getSettings();

        if (undefined === settings) {
            // Settings not loaded yet
            return;
        }

        const virtualDevices = settings.getKnownDevicesBySource(VirtualDeviceProvider.providerName);

        // Close devices whose known device has been removed from the configuration entirely.
        // Devices for merely disabled known devices are closed centrally by the device manager.
        // Snapshot first, since closing a device mutates the underlying connected-devices map.
        for (const device of [...this.getConnectedDevices()]) {
            if (!virtualDevices.has(device.getDeviceId)) {
                await device.close();
            }
        }

        // Announce all currently configured devices - the device manager takes care of skipping
        // disabled ones (and re-announcing them once re-enabled) as well as ones already connected.
        for (const knownDevice of virtualDevices.values()) {
            const deviceInfo: VirtualDeviceInfo = { type: 'virtual', id: knownDevice.id, knownDevice };

            this.deviceManager.announceDetectedDevice(deviceInfo);
        }
    }
}
