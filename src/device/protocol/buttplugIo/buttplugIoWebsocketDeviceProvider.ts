import { ButtplugClientDevice, ButtplugClient, ButtplugNodeWebsocketClientConnector } from 'buttplug'
import EventEmitter from 'events';
import ButtplugIoDevice from './buttplugIoDevice.js';
import DeviceProvider from '../../provider/deviceProvider.js';
import ButtplugIoDeviceFactory from './buttplugIoDeviceFactory.js';
import Logger from '../../../logging/Logger.js';
import { asyncHandler, setImmediateInterval } from '../../../util/async.js';
import SlvCtrlPlusButtplugWebsocketClientConnector from './slvCtrlPlusButtplugWebsocketClientConnector.js';
import DeviceManager from '../../deviceManager.js';
import { logError } from '../../../util/error.js';

export default class ButtplugIoWebsocketDeviceProvider extends DeviceProvider<ButtplugIoDevice> {
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
        this.buttplugClient.on('deviceadded', this.addButtplugIoDevice.bind(this));
        this.buttplugClient.on('deviceremoved', asyncHandler(
            this.removeButtplugIoDevice.bind(this),
            (e: unknown) => logError(this.logger, `Error in deviceremoved handler`, e)
        ));
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
            logError(this.logger, `Could not connect to buttplug.io server (${url})`, (typeof e === 'object' && e !== null && 'message' in e) ? e.message : 'unknown');
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

    private addButtplugIoDevice(buttplugDevice: ButtplugClientDevice): void {
        this.logger.info(`Device detected: ${buttplugDevice.name}`, buttplugDevice);

        try {
            const device = this.buttplugIoDeviceFactory.create(buttplugDevice, ButtplugIoWebsocketDeviceProvider.providerName, this.useDeviceNameAsId);

            this.connectedDevices.set(buttplugDevice.index, device);

            this.deviceManager.addDevice(device);

            this.logger.debug(`Assigned device id: ${device.getDeviceId} (${buttplugDevice.name}@${buttplugDevice.index})`);
            this.logger.info('Connected devices: ' + this.connectedDevices.size.toString());
        } catch (e: unknown) {
            logError(this.logger, `Could not connect to device '${buttplugDevice.name}'`, e);
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

        this.logger.info('Connected devices: ' + this.connectedDevices.size.toString());
    }
}
