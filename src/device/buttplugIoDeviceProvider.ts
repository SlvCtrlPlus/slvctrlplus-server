import DeviceProvider from "./deviceProvider.js";
import {ButtplugClientDevice, ButtplugClient, ButtplugNodeWebsocketClientConnector} from "buttplug"
import Device from "./device.js";
import ButtplugIoDeviceFactory from "./buttplugIoDeviceFactory.js";
import DeviceState from "./deviceState.js";
import EventEmitter from "events";


export default class ButtplugIoDeviceProvider extends DeviceProvider
{
    private connectedDevices: Map<number, Device> = new Map();
    private managedDevices: Map<number, null> = new Map();

    private buttplugConnector:  ButtplugNodeWebsocketClientConnector;
    private buttplugClient:  ButtplugClient;


    private readonly buttplugIoDeviceFactory: ButtplugIoDeviceFactory;

    public constructor(eventEmitter: EventEmitter, deviceFactory: ButtplugIoDeviceFactory) {
        super(eventEmitter);
        this.buttplugIoDeviceFactory = deviceFactory;
    }

    public init(): void
    {
        if (process.env.INTIFACE_PORT) {
            this.buttplugConnector = new ButtplugNodeWebsocketClientConnector(`ws://127.0.0.1:${process.env.INTIFACE_PORT}/buttplug`);
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

    private async addButtplugIoDevice(buttplugDevice: ButtplugClientDevice): Promise<void> {
        const index = buttplugDevice.index;
        const name = buttplugDevice.name;
        console.log(buttplugDevice);

        console.log('Buttplug.io device detected: ' + buttplugDevice.name);

        try {
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

            this.connectedDevices.set(buttplugDevice.index, device);

            this.eventEmitter.emit('deviceConnected', device);

            console.log(`Name: ${buttplugDevice.name}`);
            console.log(`Index: ${buttplugDevice.index}`);
            console.log(`hasBattery: ${buttplugDevice.hasBattery}`);
            console.log(`hasRssi: ${buttplugDevice.hasRssi}`);
            console.log(`vibrateAttributes: ${buttplugDevice.vibrateAttributes}`);
            console.log(`rotateAttributes: ${buttplugDevice.rotateAttributes}`);
            console.log(`linearAttributes: ${buttplugDevice.linearAttributes}`);
            console.log(`oscillateAttributes: ${buttplugDevice.oscillateAttributes}`);
            console.log(`First scalar: ${buttplugDevice.messageAttributes.ScalarCmd[0].FeatureDescriptor}`);
            console.log(`First sensor: ${buttplugDevice.messageAttributes.SensorReadCmd[0].FeatureDescriptor}`);

            console.log('Assigned device id: ' + device.getDeviceId);
            console.log('Connected devices: ' + this.connectedDevices.size.toString());


        } catch (e: unknown) {
            console.log(`Could not connect to buttplug.io device '${buttplugDevice.name}': ${(e as Error).message}`);
        }
    }

    private removeButtplugIoDevice(buttplugDevice: ButtplugClientDevice): void {
        this.connectedDevices.delete(buttplugDevice.index);
    }
}
