import Settings from '../settings/settings.js';
import KnownDevice from '../settings/knownDevice.js';
import DeviceNameGenerator from './deviceNameGenerator.js';
import Logger from '../logging/Logger.js';
import { DeviceId } from './deviceId.js';

/**
 * Looks up and registers the persisted `KnownDevice` identity for a newly detected raw device
 * (serial port, BLE peripheral, buttplug.io device, ...).
 *
 * Centralizes identity lookup/creation logic that used to be duplicated across several device
 * providers/factories. Deliberately has no opinion on *when* a newly created identity should be
 * persisted - `resolve()` never has side effects, so callers stay in control of only calling
 * `persist()` once they've actually finished building the Device successfully.
 */
export default class KnownDeviceRegistry
{
    private readonly settings: Settings;

    private readonly nameGenerator: DeviceNameGenerator;

    private readonly logger: Logger;

    public constructor(settings: Settings, nameGenerator: DeviceNameGenerator, logger: Logger) {
        this.settings = settings;
        this.nameGenerator = nameGenerator;
        this.logger = logger.child({ name: KnownDeviceRegistry.name });
    }

    /**
     * Looks up the already-known identity for `deviceId`, or builds a new (not yet persisted)
     * one if none exists.
     */
    public resolve(deviceId: DeviceId, type: string, provider: string, name?: string): KnownDevice {
        const knownDevice = this.settings.getKnownDeviceById(deviceId);

        if (undefined !== knownDevice) {
            // Already known (previously detected serial number)
            this.logger.debug(`Device is already known: ${knownDevice.id}`);
            return knownDevice;
        }

        return new KnownDevice(deviceId, name ?? this.nameGenerator.generateName(), type, provider);
    }

    /**
     * Persists a resolved identity. Safe to call unconditionally after successfully building a
     * Device, even for an already-known identity (a harmless no-op re-registration).
     */
    public persist(knownDevice: KnownDevice): void {
        this.settings.addKnownDevice(knownDevice);
    }
}
