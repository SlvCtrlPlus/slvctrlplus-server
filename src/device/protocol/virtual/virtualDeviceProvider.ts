import DeviceProvider from '../../provider/deviceProvider.js';
import Logger from '../../../logging/Logger.js';
import { AnyVirtualDevice } from './virtualDevice.js';
import KnownDevice from '../../../settings/knownDevice.js';
import SettingsManager from '../../../settings/settingsManager.js';
import SettingsEventType from '../../../settings/settingsEventType.js';
import type Settings from '../../../settings/settings.js';
import { DeviceDetectionInfo } from '../../deviceManager.js';
import VirtualDeviceFactory from './virtualDeviceFactory.js';
import DeviceManager from '../../deviceManager.js';
import { asyncHandler } from '../../../util/async.js';
import { logError } from '../../../util/error.js';
import { DetectionId } from '../../deviceId.js';

export type VirtualDeviceDetectionInfo = DeviceDetectionInfo & {
    type: 'virtual';
    knownDevice: KnownDevice;
};

export default class VirtualDeviceProvider extends DeviceProvider<VirtualDeviceDetectionInfo, AnyVirtualDevice>
{
    public static readonly providerName = 'virtual';

    private readonly deviceFactory: VirtualDeviceFactory;

    private readonly settingsManager: SettingsManager;

    private readonly settingsChangedListener: (settings: Settings) => void;

    public constructor(
        deviceManager: DeviceManager,
        deviceFactory: VirtualDeviceFactory,
        settingsManager: SettingsManager,
        logger: Logger,
    ) {
        super(deviceManager, logger.child({ name: VirtualDeviceProvider.name }));
        this.deviceFactory = deviceFactory;
        this.settingsManager = settingsManager;

        this.settingsChangedListener = asyncHandler(
            async (): Promise<void> => this.discoverVirtualDevices(),
            (e: unknown) => logError(this.logger, 'Error while scanning for virtual devices after a settings change', e),
        );
    }

    protected override async doStart(): Promise<void> {
        this.settingsManager.on(SettingsEventType.changed, this.settingsChangedListener);

        await this.discoverVirtualDevices();
    }

    protected override async doStop(): Promise<void> {
        this.settingsManager.off(SettingsEventType.changed, this.settingsChangedListener);
    }

    protected override canHandleDeviceDetectionInfo(deviceDetectionInfo: DeviceDetectionInfo): deviceDetectionInfo is VirtualDeviceDetectionInfo {
        return deviceDetectionInfo.type === 'virtual';
    }

    protected override createDevice(deviceDetectionInfo: VirtualDeviceDetectionInfo): Promise<AnyVirtualDevice> {
        this.logger.info(`Virtual device detected: ${deviceDetectionInfo.knownDevice.name}`, deviceDetectionInfo.knownDevice);

        return this.deviceFactory.create(deviceDetectionInfo.knownDevice, VirtualDeviceProvider.providerName);
    }

    private async discoverVirtualDevices(): Promise<void> {
        const settings = this.settingsManager.getSettings();

        if (undefined === settings) {
            return;
        }

        const virtualDevices = settings.getKnownDevicesBySource(VirtualDeviceProvider.providerName);

        // Close devices whose known device has been removed from the configuration entirely.
        // Snapshot first, since closing a device mutates the underlying connected-devices map.
        for (const device of [...this.getConnectedDevices()]) {
            if (!virtualDevices.has(device.getDeviceId)) {
                try {
                    await device.close();
                } catch (e: unknown) {
                    logError(this.logger, `Failed to close removed virtual device '${device.getDeviceId}'`, e);
                }
            }
        }

        // Announce all currently configured devices - the device manager takes care of skipping
        // disabled ones (and re-announcing them once re-enabled) as well as ones already connected.
        for (const knownDevice of virtualDevices.values()) {
            const deviceInfo: VirtualDeviceDetectionInfo = { type: 'virtual', detectionId: DetectionId.fromDeviceId(knownDevice.id), knownDevice };

            this.deviceManager.announceDetectedDevice(deviceInfo);
        }
    }
}
