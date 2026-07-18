import { ButtplugClientDevice, ButtplugClient, ButtplugNodeWebsocketClientConnector } from 'buttplug'
import EventEmitter from 'events';
import ButtplugIoDevice from './buttplugIoDevice.js';
import DeviceProvider from '../../provider/deviceProvider.js';
import ButtplugIoDeviceFactory from './buttplugIoDeviceFactory.js';
import Logger from '../../../logging/Logger.js';
import { asyncHandler, setImmediateInterval } from '../../../util/async.js';
import SlvCtrlPlusButtplugWebsocketClientConnector from './slvCtrlPlusButtplugWebsocketClientConnector.js';
import DeviceManager, { DeviceInfo } from '../../deviceManager.js';
import { logError } from '../../../util/error.js';
import { hasProperty } from '../../../util/objects.js';

export type ButtplugIoDeviceInfo = DeviceInfo & {
    type: 'buttplugIo';
    buttplugClientDevice: ButtplugClientDevice;
};

export default class ButtplugIoWebsocketDeviceProvider extends DeviceProvider<
    ButtplugIoDeviceInfo,
    ButtplugIoDevice
> {
    public static readonly providerName = 'buttplugIoWebsocket';

    // How often to (re)attempt connecting to the Intiface/buttplug.io server while disconnected.
    private static readonly CONNECT_RETRY_INTERVAL_MS = 1_000;

    // A buttplug.io scan is a bounded operation: the server scans, then emits 'scanningfinished'.
    // To keep discovering devices that appear later we re-scan, but pause briefly between runs
    // so we don't hammer the server's BLE adapter with back-to-back scans.
    private static readonly RESCAN_COOLDOWN_MS = 30_000;

    private buttplugConnector: ButtplugNodeWebsocketClientConnector;
    private buttplugClient: ButtplugClient;

    private readonly buttplugIoDeviceFactory: ButtplugIoDeviceFactory;

    private readonly websocketAddress: string;
    private readonly autoScan: boolean;
    private readonly useDeviceNameAsId: boolean;
    private readonly rescanCooldownMs: number;

    private connectionIntervalRef?: NodeJS.Timeout;
    private rescanTimeoutRef?: NodeJS.Timeout;

    public constructor(
        deviceManager: DeviceManager,
        eventEmitter: EventEmitter,
        deviceFactory: ButtplugIoDeviceFactory,
        websocketAddress: string,
        autoScan: boolean,
        useDeviceNameAsId: boolean,
        logger: Logger,
        rescanCooldownMs: number = ButtplugIoWebsocketDeviceProvider.RESCAN_COOLDOWN_MS
    ) {
        super(deviceManager, eventEmitter, logger.child({ name: ButtplugIoWebsocketDeviceProvider.name }));
        this.buttplugIoDeviceFactory = deviceFactory;
        this.websocketAddress = websocketAddress;
        this.autoScan = autoScan;
        this.useDeviceNameAsId = useDeviceNameAsId;
        this.rescanCooldownMs = rescanCooldownMs;

        const url = `ws://${this.websocketAddress}/buttplug`;

        this.buttplugConnector = new SlvCtrlPlusButtplugWebsocketClientConnector(url);
        this.buttplugClient = new ButtplugClient('SlvCtrlPlus');
        this.buttplugClient.on('disconnect', asyncHandler(
            this.handleLostConnection.bind(this, url),
            (e: unknown) => logError(this.logger, `Error in disconnect handler`, e)
        ));
        this.buttplugClient.on('deviceadded', this.announceButtplugIoDevice.bind(this));
        this.buttplugClient.on('deviceremoved', asyncHandler(
            this.removeButtplugIoDevice.bind(this),
            (e: unknown) => logError(this.logger, `Error in deviceremoved handler`, e)
        ));
        this.buttplugClient.on('scanningfinished', this.handleScanningFinished.bind(this));
    }

    public override async init(): Promise<void> {
        this.connectionIntervalRef ??= setImmediateInterval(() => void this.connectToServer(), ButtplugIoWebsocketDeviceProvider.CONNECT_RETRY_INTERVAL_MS);
    }

    public override async stop(): Promise<void> {
        // Marks the provider stopped (isStopped()) and closes/clears the registered devices.
        await super.stop();

        clearInterval(this.connectionIntervalRef);
        this.connectionIntervalRef = undefined;

        clearTimeout(this.rescanTimeoutRef);
        this.rescanTimeoutRef = undefined;

        // Drop the buttplug client's own listeners before disconnecting so the resulting
        // 'disconnect' event can't run handleLostConnection() and bring the provider back up.
        this.buttplugClient.removeAllListeners();

        if (this.buttplugClient.connected) {
            try {
                await this.buttplugClient.disconnect();
            } catch (e: unknown) {
                logError(this.logger, 'Could not disconnect from buttplug.io server', e);
            }
        }
    }

    private async connectToServer(): Promise<void> {
        if (this.isStopped() || this.buttplugClient.connected) {
            return;
        }

        const url = `ws://${this.websocketAddress}/buttplug`;

        try {
            await this.buttplugClient.connect(this.buttplugConnector);
            this.logger.info(`Successfully connected to buttplug.io server (${url})`);

            clearInterval(this.connectionIntervalRef);
            this.connectionIntervalRef = undefined;

            if (this.autoScan) {
                this.startScanning();
            }
        } catch (e: unknown) {
            logError(this.logger, `Could not connect to buttplug.io server (${url})`, hasProperty(e, 'message') ? e.message : 'unknown');
        }
    }

    private async handleLostConnection(url: string): Promise<void> {
        this.logger.info(`Lost connection to buttplug.io server (${url})`);

        // As the whole websocket connection is lost there aren't any 'deviceremoved' events for the
        // connected Buttplug.io devices. They need to be removed manually instead.
        for (const device of this.getConnectedDevices()) {
            await this.removeButtplugIoDevice(device.getButtplugClientDevice);
        }

        clearTimeout(this.rescanTimeoutRef);
        this.rescanTimeoutRef = undefined;

        // Don't reconnect if we're shutting down - stop() removes the listeners, but a disconnect
        // may already be in flight when it runs.
        if (this.isStopped()) {
            return;
        }

        await this.init();
    }

    /**
     * Kicks off a single device scan. The buttplug.io server ends the scan on its own and reports
     * back via the 'scanningfinished' event, which `handleScanningFinished()` uses to schedule the
     * next run - so this is a self-perpetuating loop, not a one-shot.
     */
    private startScanning(): void {
        if (this.isStopped() || !this.buttplugClient.connected) {
            return;
        }

        this.buttplugClient.startScanning()
            .then(() => this.logger.info('Start scanning for Buttplug.io devices'))
            .catch((e: unknown) => this.logger.error(`Could not start scanning for buttplug.io devices`, e));
    }

    private handleScanningFinished(): void {
        this.logger.info('Finished scanning for Buttplug.io devices');

        if (this.isStopped() || !this.autoScan || !this.buttplugClient.connected) {
            return;
        }

        this.rescanTimeoutRef ??= setTimeout(() => {
            this.rescanTimeoutRef = undefined;
            this.startScanning();
        }, this.rescanCooldownMs);
    }

    private toDeviceInfo(buttplugDevice: ButtplugClientDevice): ButtplugIoDeviceInfo {
        const deviceId = this.buttplugIoDeviceFactory.computeDeviceId(buttplugDevice, this.useDeviceNameAsId);

        return { type: 'buttplugIo', id: deviceId, buttplugClientDevice: buttplugDevice };
    }

    /**
     * Announces a device reported by the Buttplug.io server to the device manager, which runs
     * the enabled/disabled check centrally and takes care of retrying once a currently disabled
     * device gets re-enabled - see `createDevice()` for the actual construction step.
     */
    private announceButtplugIoDevice(buttplugDevice: ButtplugClientDevice): void {
        this.logger.info(`Device detected: ${buttplugDevice.name}`, buttplugDevice);

        this.deviceManager.announceDetectedDevice(this.toDeviceInfo(buttplugDevice));
    }

    protected override supportsDeviceInfo(deviceInfo: DeviceInfo): deviceInfo is ButtplugIoDeviceInfo {
        return deviceInfo.type === 'buttplugIo';
    }

    protected override createDevice(deviceInfo: ButtplugIoDeviceInfo): Promise<ButtplugIoDevice | undefined> {
        const device = this.buttplugIoDeviceFactory.create(
            deviceInfo.buttplugClientDevice,
            ButtplugIoWebsocketDeviceProvider.providerName,
            this.useDeviceNameAsId
        );

        return Promise.resolve(device);
    }

    private async removeButtplugIoDevice(buttplugDevice: ButtplugClientDevice): Promise<void> {
        const deviceId = this.buttplugIoDeviceFactory.computeDeviceId(buttplugDevice, this.useDeviceNameAsId);
        const device = this.getConnectedDevice(deviceId);

        if (undefined === device) {
            // Not locally connected - it may still be sitting in the device manager as a
            // detected-but-disabled device awaiting retry, so revoke it there to avoid leaking it.
            this.deviceManager.revokeDetectedDevice(this.toDeviceInfo(buttplugDevice));
            return;
        }

        try {
            await device.close();
            this.logger.info(`Device removed: ${device.getDeviceId} (${buttplugDevice.name}@${buttplugDevice.index})`);
        } catch (e: unknown) {
            logError(this.logger, `Could not remove device '${device.getDeviceId}' (${buttplugDevice.name}@${buttplugDevice.index})`, e);
        }
    }
}
