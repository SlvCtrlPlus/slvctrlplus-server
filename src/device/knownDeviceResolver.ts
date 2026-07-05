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

    public resolveOrCreate(deviceId: DeviceId, type: string, provider: string, name?: string): KnownDevice {
        const knownDevice = this.settings.getKnownDeviceById(deviceId);

        if (undefined !== knownDevice) {
            // Return already existing device if already known (previously detected serial number)
            this.logger.debug(`Device is already known: ${knownDevice.id}`);
            return knownDevice;
        }

        // Create a new device and persist it if not yet known
        const newKnownDevice = new KnownDevice(deviceId, name ?? this.nameGenerator.generateName(), type, provider);

        this.settings.addKnownDevice(newKnownDevice);

        return newKnownDevice;
    }
}
