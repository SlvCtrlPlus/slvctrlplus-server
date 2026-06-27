import EventEmitter from 'events';
import DeviceProvider from '../../provider/deviceProvider.js';
import Logger from '../../../logging/Logger.js';
import VirtualDevice from './virtualDevice.js';
import KnownDevice from '../../../settings/knownDevice.js';
import SettingsManager from '../../../settings/settingsManager.js';
import Device from '../../device.js';
import VirtualDeviceFactory from './virtualDeviceFactory.js';
import DeviceManager from '../../deviceManager.js';
import { asyncHandler, setImmediateInterval } from '../../../util/async.js';
import { logError } from '../../../util/error.js';

export default class VirtualDeviceProvider extends DeviceProvider<VirtualDevice<any>>
{
    public static readonly providerName = 'virtual';

    private attemptedDevices: Set<string> = new Set();
    private connectedDevices: Map<string, VirtualDevice<any>> = new Map();

    private readonly deviceFactory: VirtualDeviceFactory;

    private readonly settingsManager: SettingsManager;

    private readonly scanIntervalMs: number;

    private discoveryInterval?: NodeJS.Timeout;

    public constructor(
        deviceManager: DeviceManager,
        eventEmitter: EventEmitter,
        deviceFactory: VirtualDeviceFactory,
        settingsManager: SettingsManager,
        logger: Logger,
        scanIntervalMs: number
    ) {
        super(deviceManager, eventEmitter, logger.child({ name: VirtualDeviceProvider.name }));
        this.deviceFactory = deviceFactory;
        this.settingsManager = settingsManager;
        this.scanIntervalMs = scanIntervalMs;
    }

    public override async init(): Promise<void> {
        this.discoveryInterval ??= setImmediateInterval(asyncHandler(
            this.discoverVirtualDevices.bind(this),
            (e: unknown) => this.logger.error('Error while scanning for new virtual devices', e)
        ), this.scanIntervalMs);
    }

    public override async stop(): Promise<void> {
        if (this.discoveryInterval !== undefined) {
            clearInterval(this.discoveryInterval);
            this.discoveryInterval = undefined;
        }
    }

    private async discoverVirtualDevices(): Promise<void> {
        const settings = this.settingsManager.getSettings();

        if (undefined === settings) {
            // Settings not loaded yet
            return;
        }

        const virtualDevices = settings.getKnownDevicesBySource(VirtualDeviceProvider.providerName);

        // Check if devices have been removed
        for (const [k, v] of this.connectedDevices) {
            if (!virtualDevices.has(k)) {
                await this.removeDevice(v)
            }
        }

        // Load all currently configured devices
        for (const [k, v] of virtualDevices) {
            if (this.attemptedDevices.has(k) || this.connectedDevices.has(k)) {
                continue;
            }

            this.attemptedDevices.add(k);

            await this.addDevice(v);
        }
    }

    private async addDevice(knowDevice: KnownDevice): Promise<void> {
        this.logger.info(`Virtual device detected: ${knowDevice.name}`, knowDevice);

        try {
            const device = await this.deviceFactory.create(knowDevice, VirtualDeviceProvider.providerName);


            this.deviceManager.addDevice(device);
            this.connectedDevices.set(knowDevice.id, device);

            this.logger.info('Connected virtual devices: ' + this.connectedDevices.size.toString());
        } catch (e: unknown) {
            logError(this.logger, `Could not initiate virtual device '${knowDevice.id}'`, e);
        }
    }

    private async removeDevice(device: Device): Promise<void> {
        const deviceId = device.getDeviceId;

        try {
            await device.close();
        } finally {
            this.connectedDevices.delete(deviceId);
            this.attemptedDevices.delete(deviceId);
        }

        this.logger.info(`Device removed: ${deviceId} (${device.getDeviceName})`);
        this.logger.info(`Connected devices: ${this.connectedDevices.size.toString()}`);
    }
}
