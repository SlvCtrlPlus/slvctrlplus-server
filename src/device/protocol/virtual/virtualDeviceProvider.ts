import EventEmitter from 'events';
import DeviceProvider from '../../provider/deviceProvider.js';
import Logger from '../../../logging/Logger.js';
import VirtualDevice from './virtualDevice.js';
import KnownDevice from '../../../settings/knownDevice.js';
import SettingsManager from '../../../settings/settingsManager.js';
import SettingsEventType from '../../../settings/settingsEventType.js';
import type Settings from '../../../settings/settings.js';
import { DeviceDetectionInfo } from '../../deviceManager.js';
import VirtualDeviceFactory from './virtualDeviceFactory.js';
import DeviceManager from '../../deviceManager.js';
import { asyncHandler } from '../../../util/async.js';
import { logError } from '../../../util/error.js';

export type VirtualDeviceDetectionInfo = DeviceDetectionInfo & {
    type: 'virtual';
    knownDevice: KnownDevice;
};

export default class VirtualDeviceProvider extends DeviceProvider<VirtualDeviceDetectionInfo, VirtualDevice<any>>
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

        await this.discoverVirtualDevices();
    }

    public override async stop(): Promise<void> {
        this.settingsManager.off(SettingsEventType.changed, this.settingsChangedListener);

        await super.stop();
    }

    protected override canHandleDeviceDetectionInfo(deviceInfo: DeviceDetectionInfo): deviceInfo is VirtualDeviceDetectionInfo {
        return deviceInfo.type === 'virtual';
    }

    protected override createDevice(deviceInfo: VirtualDeviceDetectionInfo): Promise<VirtualDevice<any> | undefined> {
        this.logger.info(`Virtual device detected: ${deviceInfo.knownDevice.name}`, deviceInfo.knownDevice);

        return this.deviceFactory.create(deviceInfo.knownDevice, VirtualDeviceProvider.providerName);
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
            const deviceInfo: VirtualDeviceDetectionInfo = { type: 'virtual', detectionId: knownDevice.id, knownDevice };

            this.deviceManager.announceDetectedDevice(deviceInfo);
        }
    }
}
