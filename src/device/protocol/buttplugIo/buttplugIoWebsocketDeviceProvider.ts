import {ButtplugClientDevice, ButtplugClient, ButtplugNodeWebsocketClientConnector} from "buttplug"
import EventEmitter from "events";
import ButtplugIoDevice from "./buttplugIoDevice.js";
import DeviceProvider from "../../provider/deviceProvider.js";
import DeviceState from "../../deviceState.js";
import ButtplugIoDeviceFactory from "./buttplugIoDeviceFactory.js";
import DeviceProviderEvent from "../../provider/deviceProviderEvent.js";
import Logger from "../../../logging/Logger.js";

export default class ButtplugIoWebsocketDeviceProvider extends DeviceProvider
{
    public static readonly name = 'buttplugIoWebsocket';

    private connectedDevices: Map<number, ButtplugIoDevice> = new Map();
    private deviceUpdaters: Map<number, NodeJS.Timeout> = new Map();

    private buttplugConnector: ButtplugNodeWebsocketClientConnector;
    private buttplugClient: ButtplugClient;

    private readonly buttplugIoDeviceFactory: ButtplugIoDeviceFactory;

    private readonly websocketAddress: string;

    private readonly logger: Logger;

    public constructor(
        eventEmitter: EventEmitter,
        deviceFactory: ButtplugIoDeviceFactory,
        websocketAddress: string,
        logger: Logger
    ) {
        super(eventEmitter);
        this.buttplugIoDeviceFactory = deviceFactory;
        this.websocketAddress = websocketAddress;
        this.logger = logger.child({ name: 'buttplugIoWebsocketDeviceProvider' });
    }

    public async init(): Promise<void>
    {
        const url = `ws://${this.websocketAddress}/buttplug`;

        this.buttplugConnector = new ButtplugNodeWebsocketClientConnector(url);
        this.buttplugClient = new ButtplugClient("SlvCtrlPlus");
        this.buttplugClient.on('deviceadded', (device: ButtplugClientDevice) => this.addButtplugIoDevice(device));
        this.buttplugClient.on('deviceremoved', (device: ButtplugClientDevice) => this.removeButtplugIoDevice(device));

        try {
            await this.buttplugClient.connect(this.buttplugConnector);
            this.logger.info(`Successfully connected to buttplug.io server (${url})`);
        } catch (e: unknown) {
            this.logger.error(`Could not connect to buttplug.io server (${url})`, e);
        }
    }

    private addButtplugIoDevice(buttplugDevice: ButtplugClientDevice): void {
        // const index = buttplugDevice.index;
        // const name = buttplugDevice.name;
        // console.log(buttplugDevice);

        console.log('Buttplug.io device detected: ' + buttplugDevice.name);

        try {
            const device = this.buttplugIoDeviceFactory.create(buttplugDevice, ButtplugIoWebsocketDeviceProvider.name);

            const deviceStatusUpdater = () => {
                if (device.getState === DeviceState.busy) {
                    this.logger.trace(`Device not refreshed since it's currently busy: ${device.getDeviceId}`)
                    return;
                }

                device.refreshData().catch(
                    (e: Error) => this.logger.error(`device: ${device.getDeviceId} -> status -> failed: ${e.message}`)
                );

                this.eventEmitter.emit(DeviceProviderEvent.deviceRefreshed, device);

                this.logger.trace(`Device refreshed: ${device.getDeviceId}`)
            };

            deviceStatusUpdater();

            const deviceStatusUpdaterInterval = global.setInterval(deviceStatusUpdater, device.getRefreshInterval);

            this.connectedDevices.set(buttplugDevice.index, device);
            this.deviceUpdaters.set(buttplugDevice.index, deviceStatusUpdaterInterval);

            this.eventEmitter.emit('deviceConnected', device);

            console.log(`BPIOName: ${buttplugDevice.name}`);
            console.log(`Index: ${buttplugDevice.index}`);

            console.log('Assigned device id: ' + device.getDeviceId);
            console.log('Buttplug.io connected devices: ' + this.connectedDevices.size.toString());
        } catch (e: unknown) {
            this.logger.error(`Could not connect to buttplug.io device '${buttplugDevice.name}': ${(e as Error).message}`, e);
        }
    }

    private removeButtplugIoDevice(buttplugDevice: ButtplugClientDevice): void {
        const device = this.connectedDevices.get(buttplugDevice.index);
        const deviceUpdaterInterval = this.deviceUpdaters.get(buttplugDevice.index);

        clearInterval(deviceUpdaterInterval);
        this.eventEmitter.emit('deviceDisconnected', device);

        this.connectedDevices.delete(buttplugDevice.index);

        console.log('Buttplug.io device removed: ' + buttplugDevice.name);
        console.log('Buttplug.io connected devices: ' + this.connectedDevices.size.toString());
    }
}
