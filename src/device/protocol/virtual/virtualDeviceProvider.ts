import EventEmitter from "events";
import DeviceProvider from "../../provider/deviceProvider.js";
import Logger from "../../../logging/Logger.js";
import DeviceProviderEvent from "../../provider/deviceProviderEvent.js";
import VirtualDevice from "./virtualDevice.js";
import KnownDevice from "../../../settings/knownDevice.js";
import DelegatedVirtualDeviceFactory from "./delegatedVirtualDeviceFactory.js";
import SettingsManager from "../../../settings/settingsManager.js";

export default class VirtualDeviceProvider extends DeviceProvider
{
    public static readonly name = 'virtual';

    private connectedDevices: Map<string, VirtualDevice> = new Map();
    private deviceUpdaters: Map<string, NodeJS.Timeout> = new Map();

    private readonly deviceFactory: DelegatedVirtualDeviceFactory;

    private readonly settingsManager: SettingsManager;

    public constructor(
        eventEmitter: EventEmitter,
        deviceFactory: DelegatedVirtualDeviceFactory,
        settingsManager: SettingsManager,
        logger: Logger
    ) {
        super(eventEmitter, logger.child({ name: 'virtualDeviceProvider' }));
        this.deviceFactory = deviceFactory;
        this.settingsManager = settingsManager;
    }

    public async init(): Promise<void>
    {
        return new Promise<void>((resolve) => {
            // Scan for new virtual devices every 3 seconds
            setInterval(() => { this.discoverVirtualDevices().catch((e: Error) => this.logger.error(e.message, e)) }, 3000);
            resolve();
        })
    }

    private discoverVirtualDevices(): Promise<void> {
        return new Promise<void>((resolve) => {
            const virtualDevices = this.settingsManager.getSettings().getKnownDevicesBySource(VirtualDeviceProvider.name);

            // Check if devices have been removed
            for (const [k, v] of this.connectedDevices) {
                if (!virtualDevices.has(k)) {
                    this.removeDevice(v)
                }
            }

            // Load all currently configured devices
            for (const [k, v] of virtualDevices) {
                if (this.connectedDevices.has(k)) {
                    continue;
                }

                void this.addDevice(v);
            }

            resolve();
        })
    }

    private async addDevice(knowDevice: KnownDevice): Promise<void> {
        this.logger.info(`Virtual device detected: ${knowDevice.name}`, knowDevice);

        try {
            const device = await this.deviceFactory.create(knowDevice, VirtualDeviceProvider.name) as VirtualDevice;
            const deviceStatusUpdaterInterval = this.initDeviceStatusUpdater(device);

            this.connectedDevices.set(knowDevice.id, device);
            this.deviceUpdaters.set(device.getDeviceId, deviceStatusUpdaterInterval);

            this.eventEmitter.emit(DeviceProviderEvent.deviceConnected, device);

            this.logger.info('Connected virtual devices: ' + this.connectedDevices.size.toString());
        } catch (e: unknown) {
            this.logger.error(`Could not initiate virtual device '${knowDevice.id}': ${(e as Error).message}`, e);
        }
    }

    private removeDevice(device: VirtualDevice): void {
        const deviceUpdaterInterval = this.deviceUpdaters.get(device.getDeviceId);

        clearInterval(deviceUpdaterInterval);
        this.eventEmitter.emit(DeviceProviderEvent.deviceDisconnected, device);

        this.connectedDevices.delete(device.getDeviceId);

        this.logger.info(`Device removed: ${device.getDeviceId} (${device.getDeviceName})`);
        this.logger.info(`Connected devices: ${this.connectedDevices.size.toString()}`);
    }
}
