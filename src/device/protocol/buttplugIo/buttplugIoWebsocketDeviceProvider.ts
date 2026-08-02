import { ButtplugClientDevice, ButtplugClient, ButtplugNodeWebsocketClientConnector } from 'buttplug'
import ButtplugIoDevice from './buttplugIoDevice.js';
import DeviceProvider from '../../provider/deviceProvider.js';
import ButtplugIoDeviceFactory from './buttplugIoDeviceFactory.js';
import Logger from '../../../logging/Logger.js';
import { asyncHandler, setImmediateInterval } from '../../../util/async.js';
import SlvCtrlPlusButtplugWebsocketClientConnector from './slvCtrlPlusButtplugWebsocketClientConnector.js';
import DeviceManager, { DeviceDetectionInfo } from '../../deviceManager.js';
import { logError } from '../../../util/error.js';
import { hasProperty } from '../../../util/objects.js';
import { DeviceId, DetectionId } from '../../deviceId.js';

export type ButtplugIoDeviceDetectionInfo = DeviceDetectionInfo & {
    type: 'buttplugIo';
    buttplugClientDevice: ButtplugClientDevice;
};

export default class ButtplugIoWebsocketDeviceProvider extends DeviceProvider<
    ButtplugIoDeviceDetectionInfo,
    ButtplugIoDevice
> {
    public static readonly providerName = 'buttplugIoWebsocket';

    // How often to (re)attempt connecting to the Intiface/buttplug.io server while disconnected
    private static readonly CONNECT_RETRY_INTERVAL_MS = 1_000;

    // How often a fresh scan cycle is kicked off while `autoScan` is enabled and connected
    private static readonly AUTO_SCAN_INTERVAL_MS = 60_000;

    // How long a scan window stays open; the server scans until told to stop, so we bound it ourselves
    private static readonly SCAN_DURATION_MS = 30_000;

    private buttplugConnector: ButtplugNodeWebsocketClientConnector;
    private buttplugClient: ButtplugClient;

    private readonly buttplugIoDeviceFactory: ButtplugIoDeviceFactory;

    private readonly websocketAddress: string;
    private readonly autoScan: boolean;
    private readonly useDeviceNameAsId: boolean;

    private connectionIntervalRef?: NodeJS.Timeout;
    private autoScanningIntervalRef?: NodeJS.Timeout;

    public constructor(
        deviceManager: DeviceManager,
        deviceFactory: ButtplugIoDeviceFactory,
        websocketAddress: string,
        autoScan: boolean,
        useDeviceNameAsId: boolean,
        logger: Logger
    ) {
        super(deviceManager, logger.child({ name: ButtplugIoWebsocketDeviceProvider.name }));
        this.buttplugIoDeviceFactory = deviceFactory;
        this.websocketAddress = websocketAddress;
        this.autoScan = autoScan;
        this.useDeviceNameAsId = useDeviceNameAsId;

        const url = `ws://${this.websocketAddress}/buttplug`;

        this.buttplugConnector = new SlvCtrlPlusButtplugWebsocketClientConnector(url);
        this.buttplugClient = new ButtplugClient('SlvCtrlPlus');
    }

    protected override async doStart(): Promise<void> {
        const url = `ws://${this.websocketAddress}/buttplug`;

        this.buttplugClient.on('disconnect', asyncHandler(
            this.handleLostConnection.bind(this, url),
            (e: unknown) => logError(this.logger, `Error in disconnect handler`, e)
        ));
        this.buttplugClient.on('deviceadded', this.announceButtplugIoDevice.bind(this));
        this.buttplugClient.on('deviceremoved', this.revokePendingButtplugIoDevice.bind(this));

        this.connectClient();
    }

    protected override async doStop(): Promise<void> {
        clearInterval(this.connectionIntervalRef);
        this.connectionIntervalRef = undefined;

        clearInterval(this.autoScanningIntervalRef);
        this.autoScanningIntervalRef = undefined;

        // Dropped before disconnecting so the resulting 'disconnect' event can't run
        // handleLostConnection() and bring the provider back up
        this.buttplugClient.removeAllListeners();

        if (this.buttplugClient.connected) {
            try {
                await this.buttplugClient.disconnect();
            } catch (e: unknown) {
                logError(this.logger, 'Could not disconnect from buttplug.io server', e);
            }
        }
    }

    private connectClient(): void {
        this.connectionIntervalRef ??= setImmediateInterval(
            () => void this.connectToServer(),
            ButtplugIoWebsocketDeviceProvider.CONNECT_RETRY_INTERVAL_MS
        );
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
                this.autoScanningIntervalRef ??= setImmediateInterval(() => { this.discoverButtplugIoDevices() }, ButtplugIoWebsocketDeviceProvider.AUTO_SCAN_INTERVAL_MS);
            }
        } catch (e: unknown) {
            logError(this.logger, `Could not connect to buttplug.io server (${url})`, hasProperty(e, 'message') ? e.message : 'unknown');
        }
    }

    // The server connection is gone, so all connected devices are unreachable and must be closed
    // here - the protocol emits no per-device removal messages once the connection itself is lost
    private async handleLostConnection(url: string): Promise<void> {
        this.logger.info(`Lost connection to buttplug.io server (${url})`);

        for (const device of [...this.getConnectedDevices()]) {
            await device.close();
        }

        clearInterval(this.autoScanningIntervalRef);
        this.autoScanningIntervalRef = undefined;

        if (this.isStopped()) {
            return;
        }

        this.connectClient();
    }

    private discoverButtplugIoDevices(): void {
        if (!this.buttplugClient.connected) {
            return;
        }

        this.buttplugClient.startScanning()
            .then(() => this.logger.info('Start scanning for Buttplug.io devices'))
            .catch((e: unknown) => this.logger.error(`Could not start scanning for buttplug.io devices`, e));

        setTimeout(() => {
            if (this.isStopped() || !this.buttplugClient.connected || !this.buttplugClient.isScanning) {
                return;
            }

            this.buttplugClient.stopScanning()
                .then(() => this.logger.info('Stop scanning for Buttplug.io devices'))
                .catch((e: unknown) => this.logger.error(`Could not stop scanning for buttplug.io devices`, e));
        }, ButtplugIoWebsocketDeviceProvider.SCAN_DURATION_MS);
    }

    private createDeviceDetectionInfo(buttplugDevice: ButtplugClientDevice): ButtplugIoDeviceDetectionInfo {
        // Since we don't get a unique identifier for the Bluetooth device from Intiface,
        // we need to use the index assigned to the device by Intiface. It's the best we have.
        // or the name if using Intiface-engine without id persistence
        const nameString = buttplugDevice.name.replace(/[^a-zA-Z0-9]/g, '');
        const deviceId = DeviceId.create(this.useDeviceNameAsId ? `buttplugio-${nameString}` : `buttplugio-${buttplugDevice.index}`);

        return { type: 'buttplugIo', detectionId: DetectionId.fromDeviceId(deviceId), buttplugClientDevice: buttplugDevice };
    }

    private announceButtplugIoDevice(buttplugDevice: ButtplugClientDevice): void {
        this.logger.info(`Device detected: ${buttplugDevice.name}`, buttplugDevice);

        this.deviceManager.announceDetectedDevice(this.createDeviceDetectionInfo(buttplugDevice));
    }

    // Drops pending detection/retry bookkeeping for a removed device; a connected
    // ButtplugIoDevice closes itself off this same server event instead
    private revokePendingButtplugIoDevice(buttplugDevice: ButtplugClientDevice): void {
        this.deviceManager.revokeDetectedDevice(this.createDeviceDetectionInfo(buttplugDevice));
    }

    protected override canHandleDeviceDetectionInfo(deviceDetectionInfo: DeviceDetectionInfo): deviceDetectionInfo is ButtplugIoDeviceDetectionInfo {
        return deviceDetectionInfo.type === 'buttplugIo';
    }

    protected override createDevice(deviceDetectionInfo: ButtplugIoDeviceDetectionInfo): Promise<ButtplugIoDevice> {
        const device = this.buttplugIoDeviceFactory.create(
            DeviceId.fromDetectionId(deviceDetectionInfo.detectionId),
            deviceDetectionInfo.buttplugClientDevice,
            ButtplugIoWebsocketDeviceProvider.providerName
        );

        return Promise.resolve(device);
    }
}
