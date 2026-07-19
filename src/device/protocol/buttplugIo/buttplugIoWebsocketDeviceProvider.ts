import { ButtplugClientDevice, ButtplugClient, ButtplugNodeWebsocketClientConnector } from 'buttplug'
import EventEmitter from 'events';
import ButtplugIoDevice from './buttplugIoDevice.js';
import DeviceProvider from '../../provider/deviceProvider.js';
import ButtplugIoDeviceFactory from './buttplugIoDeviceFactory.js';
import Logger from '../../../logging/Logger.js';
import { asyncHandler, setImmediateInterval } from '../../../util/async.js';
import SlvCtrlPlusButtplugWebsocketClientConnector from './slvCtrlPlusButtplugWebsocketClientConnector.js';
import DeviceManager, { DeviceDetectionInfo } from '../../deviceManager.js';
import { logError } from '../../../util/error.js';
import { hasProperty } from '../../../util/objects.js';

export type ButtplugIoDeviceDetectionInfo = DeviceDetectionInfo & {
    type: 'buttplugIo';
    buttplugClientDevice: ButtplugClientDevice;
};

export default class ButtplugIoWebsocketDeviceProvider extends DeviceProvider<
    ButtplugIoDeviceDetectionInfo,
    ButtplugIoDevice
> {
    public static readonly providerName = 'buttplugIoWebsocket';

    private static readonly CONNECT_RETRY_INTERVAL_MS = 1_000;

    // How often a fresh scan cycle is kicked off while `autoScan` is enabled and we're connected.
    private static readonly AUTO_SCAN_INTERVAL_MS = 60_000;

    // How long a scan window stays open before we stop it again. For the desktop websocket setup
    // the server keeps scanning until told to stop, so we bound each scan ourselves rather than
    // relying on a server-sent 'scanningfinished' (which that setup does not reliably emit).
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
        eventEmitter: EventEmitter,
        deviceFactory: ButtplugIoDeviceFactory,
        websocketAddress: string,
        autoScan: boolean,
        useDeviceNameAsId: boolean,
        logger: Logger
    ) {
        super(deviceManager, eventEmitter, logger.child({ name: ButtplugIoWebsocketDeviceProvider.name }));
        this.buttplugIoDeviceFactory = deviceFactory;
        this.websocketAddress = websocketAddress;
        this.autoScan = autoScan;
        this.useDeviceNameAsId = useDeviceNameAsId;

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
    }

    public override async init(): Promise<void> {
        this.connectionIntervalRef ??= setImmediateInterval(
            () => void this.connectToServer(),
            ButtplugIoWebsocketDeviceProvider.CONNECT_RETRY_INTERVAL_MS
        );
    }

    public override async stop(): Promise<void> {
        // Marks the provider stopped (isStopped()) and closes/clears the registered devices.
        await super.stop();

        clearInterval(this.connectionIntervalRef);
        this.connectionIntervalRef = undefined;

        clearInterval(this.autoScanningIntervalRef);
        this.autoScanningIntervalRef = undefined;

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
                this.autoScanningIntervalRef ??= setImmediateInterval(() => { this.discoverButtplugIoDevices() }, ButtplugIoWebsocketDeviceProvider.AUTO_SCAN_INTERVAL_MS);
            }
        } catch (e: unknown) {
            logError(this.logger, `Could not connect to buttplug.io server (${url})`, hasProperty(e, 'message') ? e.message : 'unknown');
        }
    }

    private async handleLostConnection(url: string): Promise<void> {
        this.logger.info(`Lost connection to buttplug.io server (${url})`);

        for (const device of this.getConnectedDevices()) {
            await this.removeButtplugIoDevice(device.getButtplugClientDevice);
        }

        clearInterval(this.autoScanningIntervalRef);
        this.autoScanningIntervalRef = undefined;

        if (this.isStopped()) {
            return;
        }

        await this.init();
    }

    private discoverButtplugIoDevices(): void {
        if (!this.buttplugClient.connected) {
            return;
        }

        this.buttplugClient.startScanning()
            .then(() => this.logger.info('Start scanning for Buttplug.io devices'))
            .catch((e: unknown) => this.logger.error(`Could not start scanning for buttplug.io devices`, e));

        setTimeout(() => {
            if (undefined === this.buttplugClient || !this.buttplugClient.isScanning) {
                return;
            }

            this.buttplugClient.stopScanning()
                .then(() => this.logger.info('Stop scanning for Buttplug.io devices'))
                .catch((e: unknown) => this.logger.error(`Could not stop scanning for buttplug.io devices`, e));
        }, ButtplugIoWebsocketDeviceProvider.SCAN_DURATION_MS);
    }

    private toDeviceInfo(buttplugDevice: ButtplugClientDevice): ButtplugIoDeviceDetectionInfo {
        const deviceId = ButtplugIoDeviceFactory.computeDeviceId(buttplugDevice, this.useDeviceNameAsId);

        return { type: 'buttplugIo', detectionId: deviceId, buttplugClientDevice: buttplugDevice };
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

    protected override canHandleDeviceDetectionInfo(deviceInfo: DeviceDetectionInfo): deviceInfo is ButtplugIoDeviceDetectionInfo {
        return deviceInfo.type === 'buttplugIo';
    }

    protected override createDevice(deviceInfo: ButtplugIoDeviceDetectionInfo): Promise<ButtplugIoDevice | undefined> {
        const device = this.buttplugIoDeviceFactory.create(
            deviceInfo.buttplugClientDevice,
            ButtplugIoWebsocketDeviceProvider.providerName,
            this.useDeviceNameAsId
        );

        return Promise.resolve(device);
    }

    private async removeButtplugIoDevice(buttplugDevice: ButtplugClientDevice): Promise<void> {
        const deviceId = ButtplugIoDeviceFactory.computeDeviceId(buttplugDevice, this.useDeviceNameAsId);
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
