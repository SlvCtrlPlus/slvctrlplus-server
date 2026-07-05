import Settings from '../settings/settings.js';
import KnownDevice from '../settings/knownDevice.js';
import DeviceNameGenerator from './deviceNameGenerator.js';
import Logger from '../logging/Logger.js';
import { DeviceId } from './deviceId.js';

/**
 * Resolves the persisted `KnownDevice` identity for a newly detected raw device (serial port,
 * BLE peripheral, buttplug.io device, ...), creating and persisting a new entry if none exists yet.
 *
 * Centralizes logic that used to be duplicated across several device providers/factories.
 */
export default class KnownDeviceResolver
{
    private readonly settings: Settings;

    private readonly nameGenerator: DeviceNameGenerator;

    private readonly logger: Logger;

    public constructor(settings: Settings, nameGenerator: DeviceNameGenerator, logger: Logger) {
        this.settings = settings;
        this.nameGenerator = nameGenerator;
        this.logger = logger.child({ name: KnownDeviceResolver.name });
    }

    /**
     * Resolves the KnownDevice identity for `deviceId` and hands it to `buildDevice` to actually
     * construct the Device. A newly created (not previously known) KnownDevice is only persisted
     * once `buildDevice` has *successfully* returned - if it throws, nothing is written to
     * settings, so a failed connection attempt can never leak a phantom known device.
     */
    public async resolveOrCreate<D>(
        deviceId: DeviceId,
        type: string,
        provider: string,
        buildDevice: (knownDevice: KnownDevice) => Promise<D> | D,
        name?: string,
    ): Promise<D> {
        const existingKnownDevice = this.settings.getKnownDeviceById(deviceId);

        if (undefined !== existingKnownDevice) {
            // Already known (previously detected serial number) - nothing to persist here
            this.logger.debug(`Device is already known: ${existingKnownDevice.id}`);
            return buildDevice(existingKnownDevice);
        }

        const newKnownDevice = new KnownDevice(deviceId, name ?? this.nameGenerator.generateName(), type, provider);

        const device = await buildDevice(newKnownDevice);

        // Only persist once the device has actually been built successfully
        this.settings.addKnownDevice(newKnownDevice);

        return device;
    }
}
