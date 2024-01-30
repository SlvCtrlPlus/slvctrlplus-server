import {ButtplugClientDevice, ButtplugClient, ButtplugNodeWebsocketClientConnector} from "buttplug"
import EventEmitter from "events";
import ButtplugIoDevice from "./buttplugIoDevice.js";
import DeviceProvider from "../../provider/deviceProvider.js";
import ButtplugIoDeviceFactory from "./buttplugIoDeviceFactory.js";
import Logger from "../../../logging/Logger.js";
import DeviceProviderEvent from "../../provider/deviceProviderEvent.js";

export default class ButtplugIoWebsocketDeviceProvider extends DeviceProvider
{
    public static readonly name = 'buttplugIoWebsocket';

    private connectedDevices: Map<number, ButtplugIoDevice> = new Map();
    private deviceUpdaters: Map<number, NodeJS.Timeout> = new Map();

    private buttplugConnector: ButtplugNodeWebsocketClientConnector;
    private buttplugClient: ButtplugClient;

    private readonly buttplugIoDeviceFactory: ButtplugIoDeviceFactory;

    private readonly websocketAddress: string;
    private readonly autoScan: boolean;
    private readonly useDeviceNameAsId: boolean;

    public constructor(
        eventEmitter: EventEmitter,
        deviceFactory: ButtplugIoDeviceFactory,
        websocketAddress: string,
        autoScan: boolean,
        useDeviceNameAsId: boolean,
        logger: Logger
    ) {
        super(eventEmitter, logger.child({ name: 'buttplugIoWebsocketDeviceProvider' }));
        this.buttplugIoDeviceFactory = deviceFactory;
        this.websocketAddress = websocketAddress;
        this.autoScan = autoScan;
        this.useDeviceNameAsId = useDeviceNameAsId;
    }

    public async init(): Promise<void>
    {
        return new Promise<void>((resolve) => {
            const url = `ws://${this.websocketAddress}/buttplug`;

            this.buttplugConnector = new ButtplugNodeWebsocketClientConnector(url);
            this.buttplugClient = new ButtplugClient("SlvCtrlPlus");
            this.buttplugClient.on('disconnect', () => {
                this.logger.info(`Lost connection to buttplug.io server (${url})`);

                // As the whole websocket connection is lost there aren't any 'deviceremoved' events for the
                // connected Buttplug.io devices. They need to be removed manually instead.
                this.connectedDevices.forEach((d) => this.removeButtplugIoDevice(d.getButtplugClientDevice));
            });
            this.buttplugClient.on('deviceadded', (device: ButtplugClientDevice) => this.addButtplugIoDevice(device));
            this.buttplugClient.on('deviceremoved', (device: ButtplugClientDevice) => this.removeButtplugIoDevice(device));

            this.connectToServer();

            setInterval(() => { this.connectToServer() }, 3000);

            if (true === this.autoScan) {
                setInterval(() => { this.discoverButtplugIoDevices() }, 60000);
            }

            resolve();
        });
    }

    private connectToServer(): void {
        if (this.buttplugClient.connected) {
            return;
        }

        const url = `ws://${this.websocketAddress}/buttplug`;

        this.buttplugClient.connect(this.buttplugConnector)
            .then(() => this.logger.info(`Successfully connected to buttplug.io server (${url})`))
            .catch((e: unknown) => this.logger.error(`Could not connect to buttplug.io server (${url})`, e));
    }


    private discoverButtplugIoDevices(): void {
        if (false === this.buttplugClient.connected) {
            return;
        }

        this.buttplugClient.startScanning()
            .then(() => this.logger.info('Start scanning for Buttplug.io devices'))
            .catch((e: unknown) => this.logger.error(`Could not start scanning for buttplug.io devices`, e));

        setTimeout(() => {
            this.buttplugClient.stopScanning()
                .then(() => this.logger.info('Stop scanning for Buttplug.io devices'))
                .catch((e: unknown) => this.logger.error(`Could not stop scanning for buttplug.io devices`, e));
        }, 30000);
    }


    private addButtplugIoDevice(buttplugDevice: ButtplugClientDevice): void {
        this.logger.info(`Buttplug.io device detected: ${buttplugDevice.name}`, buttplugDevice);

        try {
            const device = this.buttplugIoDeviceFactory.create(buttplugDevice, ButtplugIoWebsocketDeviceProvider.name);
            const deviceStatusUpdaterInterval = this.initDeviceStatusUpdater(device);

            this.connectedDevices.set(buttplugDevice.index, device);
            this.deviceUpdaters.set(buttplugDevice.index, deviceStatusUpdaterInterval);

            this.eventEmitter.emit(DeviceProviderEvent.deviceConnected, device);

            this.logger.debug(`Assigned device id: ${device.getDeviceId} (${buttplugDevice.name}@${buttplugDevice.index})`);
            this.logger.info('Connected devices: ' + this.connectedDevices.size.toString());
        } catch (e: unknown) {
            this.logger.error(`Could not connect to buttplug.io device '${buttplugDevice.name}': ${(e as Error).message}`, e);
        }
    }

    private removeButtplugIoDevice(buttplugDevice: ButtplugClientDevice): void {
        const device = this.connectedDevices.get(buttplugDevice.index);
        const deviceUpdaterInterval = this.deviceUpdaters.get(buttplugDevice.index);

        clearInterval(deviceUpdaterInterval);
        this.eventEmitter.emit(DeviceProviderEvent.deviceDisconnected, device);

        this.connectedDevices.delete(buttplugDevice.index);

        this.logger.info(`Device removed: ${device.getDeviceId} (${buttplugDevice.name}@${buttplugDevice.index})`);
        this.logger.info('Connected devices: ' + this.connectedDevices.size.toString());
    }
}
