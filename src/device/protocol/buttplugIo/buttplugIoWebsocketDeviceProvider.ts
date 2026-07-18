import { ButtplugClientDevice, ButtplugClient, ButtplugNodeWebsocketClientConnector } from 'buttplug'
import EventEmitter from 'events';
import ButtplugIoDevice from './buttplugIoDevice.js';
import { DeviceEvent } from '../../device.js';
import DeviceProvider from '../../provider/deviceProvider.js';
import ButtplugIoDeviceFactory from './buttplugIoDeviceFactory.js';
import Logger from '../../../logging/Logger.js';
import { asyncHandler, setImmediateInterval } from '../../../util/async.js';
import SlvCtrlPlusButtplugWebsocketClientConnector from './slvCtrlPlusButtplugWebsocketClientConnector.js';
import DeviceManager, { DeviceInfo, DeviceManagerEvent } from '../../deviceManager.js';
import { logError } from '../../../util/error.js';
import { hasProperty } from '../../../util/objects.js';

export type ButtplugIoDeviceInfo = DeviceInfo & {
    type: 'buttplugIo';
    buttplugClientDevice: ButtplugClientDevice;
};

export default class ButtplugIoWebsocketDeviceProvider extends DeviceProvider {
    public static readonly providerName = 'buttplugIoWebsocket';

    private connectedDevices: Map<number, ButtplugIoDevice> = new Map();

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

        this.deviceManager.on(
            DeviceManagerEvent.deviceDetected,
            asyncHandler(
                this.handleDeviceDetection.bind(this),
                (err: unknown) => logError(this.logger, 'Error in device detection handler', err)
            )
        );
    }

    public override async init(): Promise<void> {
        this.connectionIntervalRef ??= setImmediateInterval(() => void this.connectToServer(), 1000);
    }

    private async connectToServer(): Promise<void> {
        if (this.buttplugClient.connected) {
            return;
        }

        const url = `ws://${this.websocketAddress}/buttplug`;

        try {
            await this.buttplugClient.connect(this.buttplugConnector);
            this.logger.info(`Successfully connected to buttplug.io server (${url})`);

            clearInterval(this.connectionIntervalRef);
            this.connectionIntervalRef = undefined;

            if (this.autoScan) {
                this.autoScanningIntervalRef ??= setImmediateInterval(() => { this.discoverButtplugIoDevices() }, 60000);
            }
        } catch (e: unknown) {
            logError(this.logger, `Could not connect to buttplug.io server (${url})`, hasProperty(e, 'message') ? e.message : 'unknown');
        }
    }

    private async handleLostConnection(url: string): Promise<void> {
        this.logger.info(`Lost connection to buttplug.io server (${url})`);

        // As the whole websocket connection is lost there aren't any 'deviceremoved' events for the
        // connected Buttplug.io devices. They need to be removed manually instead.
        for (const device of this.connectedDevices.values()) {
            await this.removeButtplugIoDevice(device.getButtplugClientDevice);
        }

        clearInterval(this.autoScanningIntervalRef);
        this.autoScanningIntervalRef = undefined;

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
        }, 30000);
    }

    /**
     * Announces a device reported by the Buttplug.io server to the device manager, which runs
     * the enabled/disabled check centrally and takes care of retrying once a currently disabled
     * device gets re-enabled - see `handleDeviceDetection()` below for the rest of the flow.
     */
    private announceButtplugIoDevice(buttplugDevice: ButtplugClientDevice): void {
        this.logger.info(`Device detected: ${buttplugDevice.name}`, buttplugDevice);

        const deviceId = this.buttplugIoDeviceFactory.computeDeviceId(buttplugDevice, this.useDeviceNameAsId);

        const deviceInfo: ButtplugIoDeviceInfo = { type: 'buttplugIo', id: deviceId, buttplugClientDevice: buttplugDevice };

        this.deviceManager.announceDetectedDevice(deviceInfo);
    }

    private isButtplugIoDeviceInfo(deviceInfo: DeviceInfo): deviceInfo is ButtplugIoDeviceInfo {
        return deviceInfo.type === 'buttplugIo';
    }

    private async handleDeviceDetection(deviceInfo: DeviceInfo): Promise<void> {
        if (!this.isButtplugIoDeviceInfo(deviceInfo)) {
            return;
        }

        const buttplugDevice = deviceInfo.buttplugClientDevice;

        const acquireResult = await this.deviceManager.acquireDetectedDevice(deviceInfo.id);

        if (!acquireResult.successful) {
            this.logger.debug(`Could not acquire device: ${acquireResult.reason}`);
            return;
        }

        try {
            const device = this.buttplugIoDeviceFactory.create(buttplugDevice, ButtplugIoWebsocketDeviceProvider.providerName, this.useDeviceNameAsId);

            // Keep local bookkeeping in sync regardless of what closes the device (e.g. the
            // device manager closing it right away because it has been disabled in the meantime).
            device.on(DeviceEvent.deviceDisconnected, () => this.connectedDevices.delete(buttplugDevice.index));

            if (!this.deviceManager.addDevice(deviceInfo, device)) {
                // The device turned out to belong to a disabled known device after all -
                // addDevice() has already closed it, released it from the acquire queue, and
                // registered it for retry once re-enabled.
                return;
            }

            this.connectedDevices.set(buttplugDevice.index, device);

            this.logger.debug(`Assigned device id: ${device.getDeviceId} (${buttplugDevice.name}@${buttplugDevice.index})`);
            this.logger.info(`Connected devices: ${this.connectedDevices.size}`);
        } catch (e: unknown) {
            logError(this.logger, `Could not connect to device '${buttplugDevice.name}'`, e);
            this.deviceManager.releaseDetectedDevice(deviceInfo.id);
        }
    }

    private async removeButtplugIoDevice(buttplugDevice: ButtplugClientDevice): Promise<void> {
        const device = this.connectedDevices.get(buttplugDevice.index);

        if (undefined === device) {
            this.logger.warn(
                `Could not find device to remove: ${buttplugDevice.name}@${buttplugDevice.index}`
            );
            return;
        }

        try {
            await device.close();
            this.connectedDevices.delete(buttplugDevice.index);

            this.logger.info(`Device removed: ${device.getDeviceId} (${buttplugDevice.name}@${buttplugDevice.index})`);
        } catch (e: unknown) {
            logError(this.logger, `Could not remove device '${device.getDeviceId}' (${buttplugDevice.name}@${buttplugDevice.index})`, e);
        }

        this.logger.info(`Connected devices: ${this.connectedDevices.size}`);
    }
}
