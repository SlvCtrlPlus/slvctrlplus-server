import GenericDevice from "./genericDevice.js";
import {ReadlineParser, ReadyParser, SerialPort} from "serialport";
import SynchronousSerialPort from "../serial/SynchronousSerialPort.js";
import DeviceFactory from "./deviceFactory.js";
import {PortInfo} from "@serialport/bindings-interface/dist/index.js";
import Device from "./device";

export default class DeviceManager
{
    private static readonly moduleReadyByte = 0x07;

    private connectedDevices: Map<string, Device> = new Map();
    private managedDevices: Map<string, null> = new Map();

    private readonly deviceFactory: DeviceFactory;

    public constructor(deviceFactory: DeviceFactory) {
        this.deviceFactory = deviceFactory;
    }

    public async discover(): Promise<void> {
        const foundDevices: Map<string, null> = new Map();

        try {
            const ports = await SerialPort.list();

            for (const portInfo of ports) {
                if (!portInfo.path.startsWith('/dev/tty.usb') || '' === portInfo.serialNumber) {
                    continue;
                }

                foundDevices.set(portInfo.serialNumber, null);

                if (!this.managedDevices.has(portInfo.serialNumber)) {
                    this.managedDevices.set(portInfo.serialNumber, null);
                    console.log('Managed devices: ' + this.managedDevices.size.toString());

                    if (portInfo.vendorId === '2341') {
                        // It's an arduino
                        this.addArduinoDevice(portInfo);
                    } else {
                        // It's something else
                        this.addDevice(portInfo);
                    }
                }
            }

            for (const [key] of this.managedDevices) {
                if (!foundDevices.has(key)) {
                    this.managedDevices.delete(key);
                    console.log('Managed devices: ' + this.managedDevices.size.toString());
                }
            }
        } catch (err) {
            console.log('Could not list serial ports: ' + (err as Error).message);
        }
    }

    public addDevice(portInfo: PortInfo): void
    {
        const port = new SerialPort({path: portInfo.path, baudRate: 9600, autoOpen: false });
        port.on('error', err => console.log(err));

        // Generic usb-serial device code
        port.open((err: Error) => {
            if (null !== err) {
                console.log('Error in communication with device ' + portInfo.path + ': ' + err.message);
                return;
            }

            console.log('Connection opened for device: ' + portInfo.path);
            this.connectDevice(port, portInfo).catch(console.log);
        });
    }

    public addArduinoDevice(portInfo: PortInfo): void
    {
        const port = new SerialPort({path: portInfo.path, baudRate: 9600, autoOpen: false });
        const readyParser = port.pipe(new ReadyParser({delimiter: [DeviceManager.moduleReadyByte]}));

        port.on('error', err => console.log(err));

        // slvCtrl specific code (device type detection, etc)
        readyParser.on('ready', () => {
            console.log('Received ready bytes from serial device');
            port.unpipe(readyParser);

            this.connectDevice(port, portInfo).catch(console.log);
        });

        // Generic usb-serial device code
        port.open((err: Error) => {
            if (null !== err) {
                console.log('Error in communication with device ' + portInfo.path + ': ' + err.message);
                return;
            }

            console.log('Connection opened for device: ' + portInfo.path);
        });
    }

    private async connectDevice(port: SerialPort, portInfo: PortInfo): Promise<void>
    {
        const parser = port.pipe(new ReadlineParser({delimiter: '\r\n'}));
        const syncPort = new SynchronousSerialPort(parser, port);

        const result = await syncPort.writeLineAndExpect('introduce');
        console.log('Module detected: ' + result);

        const device = this.deviceFactory.create(result, syncPort, portInfo);

        this.connectedDevices.set(device.getDeviceId, device);

        console.log('Path: ' + portInfo.path);
        console.log('Manufacturer: ' + portInfo.manufacturer);
        console.log('Serial no.: ' + portInfo.serialNumber);
        console.log('Location ID: ' + portInfo.locationId);
        console.log('Product ID: ' + portInfo.productId);
        console.log('Vendor ID: ' + portInfo.vendorId);
        console.log('pnp ID: ' + portInfo.pnpId);

        console.log('Assigned device id: ' + device.getDeviceId);
        console.log('Connected devices: ' + this.connectedDevices.size.toString());

        port.on('close', () => {
            this.connectedDevices.delete(device.getDeviceId);

            console.log('Lost device: ' + device.getDeviceId);
            console.log('Connected devices: ' + this.connectedDevices.size.toString());
        });
    }

    public get getConnectedDevices(): Device[]
    {
        return Array.from(this.connectedDevices.values());
    }

    public getConnectedDevice(uuid: string): Device|null
    {
        const device = this.connectedDevices.get(uuid);

        return undefined !== device ? device : null;
    }
}
