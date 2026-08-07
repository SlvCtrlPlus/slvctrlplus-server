import Settings from '../settings/settings.js';
import KnownDevice from '../settings/knownDevice.js';
import DeviceNameGenerator from './deviceNameGenerator.js';
import Logger from '../logging/Logger.js';
import { DeviceId } from './deviceId.js';

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

    public resolve(deviceId: DeviceId, type: string, provider: string, name?: string): KnownDevice {
        const knownDevice = this.settings.getKnownDeviceById(deviceId);

        if (knownDevice?.type === type) {
            // Already known (previously detected serial number)
            this.logger.debug(`Device is already known: ${knownDevice.id}`);
            return knownDevice;
        }

        if (undefined !== knownDevice) {
            this.logger.warn(
                `Device id ${knownDevice.id} is known, but as type '${knownDevice.type}' instead of '${type}' - treating as an unknown device`,
            );
        }

        return new KnownDevice(deviceId, name ?? this.nameGenerator.generateName(), type, provider);
    }

    public persist(knownDevice: KnownDevice): void {
        if (this.settings.getKnownDeviceById(knownDevice.id) === knownDevice) {
            return;
        }

        this.settings.addKnownDevice(knownDevice);
    }
}
