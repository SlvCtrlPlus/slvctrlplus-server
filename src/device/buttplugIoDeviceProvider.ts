import DeviceProvider from "./deviceProvider.js";
import {ButtplugClientDevice, ButtplugClient, ButtplugNodeWebsocketClientConnector} from "buttplug"
import Device from "./device.js";
//import ButtplugIoDeviceFactory from "./buttplugIoDeviceFactory.js";
import DeviceState from "./deviceState.js";
import EventEmitter from "events";


export default class ButtplugIoDeviceProvider extends DeviceProvider
{
    private connectedDevices: Map<string, Device> = new Map();
    private managedDevices: Map<string, null> = new Map();

    private buttplugConnector:  ButtplugNodeWebsocketClientConnector;
    private buttplugClient:  ButtplugClient;


    //private readonly buttplugIoDeviceFactory: ButtplugIoDeviceFactory;

    public constructor(eventEmitter: EventEmitter) {//, deviceFactory: ButtplugIoDeviceFactory) {
        super(eventEmitter);
        //this.buttplugIoDeviceFactory = deviceFactory;
    }

    public init(): void
    {
        if (process.env.INTIFACE_PORT) {
            this.buttplugConnector = new ButtplugNodeWebsocketClientConnector("ws://127.0.0.1:" + process.env.INTIFACE_PORT + "/buttplug");
            this.buttplugClient = new ButtplugClient("SlvCtrlPlus");
            this.buttplugClient.connect(this.buttplugConnector);
            this.buttplugClient.on('deviceadded', (device) => this.addButtplugIoDevice(device));
            this.buttplugClient.on('deviceremoved', (device) => this.removeButtplugIoDevice(device));

            setInterval(() => { this.discoverButtplugIoDevices().catch(console.log) }, 30000);

        }
    }

    private async discoverButtplugIoDevices(): Promise<void>
    {
        console.log('Start scanning for Buttplug.io devices');
        this.buttplugClient.startScanning();
        setTimeout(() => { this.buttplugClient.stopScanning(); }, 15000);
    }

    private addButtplugIoDevice(buttplugDevice: ButtplugClientDevice): void {
        const index = buttplugDevice.index;
        const name = buttplugDevice.name;


        console.log('Buttplug.io device detected: ' + buttplugDevice.name);

        /*try {
            const device = await this.buttplugIoDeviceFactory.create(buttplugDevice);

            const deviceStatusUpdater = () => {
                if (device.getState === DeviceState.busy) {
                    return;
                }
                device.refreshData();
                this.eventEmitter.emit('deviceRefreshed', device);
            };

            deviceStatusUpdater();

            const deviceStatusUpdaterInterval = setInterval(deviceStatusUpdater, device.getRefreshInterval);

            this.connectedDevices.set(device.getDeviceId, device);

            this.eventEmitter.emit('deviceConnected', device);

            console.log(`Name: ${buttplugDevice.name}`);
            console.log(`Index: ${buttplugDevice.index}`);
            console.log(`First scalar: ${device.messageAttributes.ScalarCmd[0].ActuatorType}`);
            console.log(`First sensor: ${device.messageAttributes.SensorReadCmd[0].SensorType}`);

            console.log('Assigned device id: ' + device.getDeviceId);
            console.log('Connected devices: ' + this.connectedDevices.size.toString());

            port.on('close', () => {
                clearInterval(deviceStatusUpdaterInterval);
                this.connectedDevices.delete(device.getDeviceId);

                this.eventEmitter.emit('deviceDisconnected', device);

                console.log('Lost device: ' + device.getDeviceId);
                console.log('Connected devices: ' + this.connectedDevices.size.toString());
            });
        } catch (e: unknown) {
            console.log(`Could not connect to serial device '${portInfo.serialNumber}': ${(e as Error).message}`);
        }*/
    }

    private removeButtplugIoDevice(buttplugDevice: ButtplugClientDevice): void {
    }
}
