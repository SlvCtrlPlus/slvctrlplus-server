import DeviceProvider from "../../provider/deviceProvider.js";
import {ReadlineParser, ReadyParser, SerialPort} from "serialport";
import {PortInfo} from "@serialport/bindings-interface";
import Device from "../../device.js";
import SlvCtrlPlusDeviceFactory from "./slvCtrlPlusDeviceFactory.js";
import SynchronousSerialPort from "../../../serial/SynchronousSerialPort.js";
import EventEmitter from "events";
import SerialDeviceTransportFactory from "../../transport/serialDeviceTransportFactory.js";
import DeviceProviderEvent from "../../provider/deviceProviderEvent.js";
import Logger from "../../../logging/Logger.js";

export default class SlvCtrlPlusSerialDeviceProvider extends DeviceProvider
{
    public static readonly name = 'slvCtrlPlusSerial';

    private static readonly moduleReadyByte = 0x07;

    private static readonly arduinoVendorId = '2341';

    private connectedDevices: Map<string, Device> = new Map();
    private managedDevices: Map<string, null> = new Map();

    private readonly slvCtrlPlusDeviceFactory: SlvCtrlPlusDeviceFactory;

    private readonly deviceTransportFactory: SerialDeviceTransportFactory;

    public constructor(
        eventEmitter: EventEmitter,
        deviceFactory: SlvCtrlPlusDeviceFactory,
        deviceTransportFactory: SerialDeviceTransportFactory,
        logger: Logger
    ) {
        super(eventEmitter, logger.child({name: 'slvCtrlPlusSerialDeviceProvider'}));
        this.slvCtrlPlusDeviceFactory = deviceFactory;
        this.deviceTransportFactory = deviceTransportFactory;
    }

    public async init(): Promise<void>
    {
        return new Promise<void>((resolve) => {
            // Scan for new SlvCtrl+ protocol serial devices every 3 seconds
            setInterval(() => { this.discoverSerialDevices().catch((e: Error) => this.logger.error(e.message, e)) }, 3000);
            resolve();
        })
    }

    private async discoverSerialDevices(): Promise<void>
    {
        const foundDevices: Map<string, null> = new Map();

        try {
            const ports = await SerialPort.list();

            for (const portInfo of ports) {
                if (undefined === portInfo.serialNumber || '' === portInfo.serialNumber) {
                    continue;
                }

                foundDevices.set(portInfo.serialNumber, null);

                if (!this.managedDevices.has(portInfo.serialNumber)) {
                    this.managedDevices.set(portInfo.serialNumber, null);
                    this.logger.debug('Managed devices: ' + this.managedDevices.size.toString());

                    this.addSerialDevice(portInfo);
                }
            }

            for (const [key] of this.managedDevices) {
                if (!foundDevices.has(key)) {
                    this.managedDevices.delete(key);
                    this.logger.info('Managed devices: ' + this.managedDevices.size.toString());
                }
            }
        } catch (err) {
            this.logger.error('Could not list serial ports: ' + (err as Error).message, err);
        }
    }

    private addSerialDevice(portInfo: PortInfo): void {
        if (portInfo.vendorId === SlvCtrlPlusSerialDeviceProvider.arduinoVendorId) {
            // It's an arduino
            this.addArduinoSerialDevice(portInfo);
        } else {
            // It's something else
            this.addOtherSerialDevice(portInfo);
        }
    }

    private addOtherSerialDevice(portInfo: PortInfo): void
    {
        const port = new SerialPort({path: portInfo.path, baudRate: 9600, autoOpen: false });
        port.on('error', err => this.logger.error(err.message, err));
        // Generic usb-serial device code
        port.open((err: Error) => {
            if (null !== err) {
                this.logger.error('Error in communication with device ' + portInfo.path + ': ' + err.message, err);
                return;
            }

            this.logger.info('Connection opened for device: ' + portInfo.path);
            this.connectSerialDevice(port, portInfo).catch((e: Error) => this.logger.error(e.message, e));
        });
    }

    private addArduinoSerialDevice(portInfo: PortInfo): void
    {
        const port = new SerialPort({path: portInfo.path, baudRate: 9600, autoOpen: false });
        const readyParser = port.pipe(new ReadyParser({delimiter: [SlvCtrlPlusSerialDeviceProvider.moduleReadyByte]}));

        port.on('error', err => this.logger.error(err.message, err));

        // slvCtrl specific code (device type detection, etc)
        const readyHandler = () => {
            this.logger.debug('Received ready bytes from serial device');
            readyParser.removeListener('ready', readyHandler);
            port.unpipe(readyParser);

            this.connectSerialDevice(port, portInfo).catch((err: Error) => this.logger.error(err.message, err));
        };

        readyParser.on('ready', readyHandler);

        // Generic usb-serial device code
        port.open((err: Error) => {
            if (null !== err) {
                this.logger.error('Error in communication with device ' + portInfo.path + ': ' + err.message, err);
                return;
            }

            this.logger.info('Connection opened for device: ' + portInfo.path);
        });
    }

    private async connectSerialDevice(port: SerialPort, portInfo: PortInfo): Promise<void>
    {
        const parser = port.pipe(new ReadlineParser({delimiter: '\n'}));
        const syncPort = new SynchronousSerialPort(portInfo, parser, port, this.logger);

        this.logger.debug(`Ask serial device for introduction (${portInfo.serialNumber})`, portInfo);
        await syncPort.writeAndExpect("clear\n", 0);
        const result = await syncPort.writeAndExpect("introduce\n", 0);
        this.logger.info(`Module detected: ${result} (${portInfo.serialNumber})`);

        try {
            const transport = this.deviceTransportFactory.create(syncPort);
            const device = await this.slvCtrlPlusDeviceFactory.create(
                result,
                transport,
                SlvCtrlPlusSerialDeviceProvider.name
            );
            const deviceStatusUpdaterInterval = this.initDeviceStatusUpdater(device);

            this.connectedDevices.set(device.getDeviceId, device);

            this.eventEmitter.emit(DeviceProviderEvent.deviceConnected, device);

            this.logger.debug(`Assigned device id: ${device.getDeviceId} (${portInfo.serialNumber})`);
            this.logger.info('Connected devices: ' + this.connectedDevices.size.toString());

            port.on('close', () => {
                clearInterval(deviceStatusUpdaterInterval);
                this.connectedDevices.delete(device.getDeviceId);

                this.eventEmitter.emit(DeviceProviderEvent.deviceDisconnected, device);

                this.logger.info('Lost serial device: ' + device.getDeviceId);
                this.logger.info('Connected SlvCtrl+ serial devices: ' + this.connectedDevices.size.toString());
            });
        } catch (err: unknown) {
            this.logger.error(
                `Could not connect to serial device '${portInfo.serialNumber}': ${(err as Error).message}`,
                err
            );
        }
    }
}
