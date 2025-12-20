import {ReadlineParser, ReadyParser, SerialPort} from "serialport";
import type {PortInfo} from "@serialport/bindings-interface";
import Device from "../../device.js";
import SlvCtrlPlusDeviceFactory from "./slvCtrlPlusDeviceFactory.js";
import SynchronousSerialPort from "../../../serial/SynchronousSerialPort.js";
import EventEmitter from "events";
import SerialDeviceTransportFactory from "../../transport/serialDeviceTransportFactory.js";
import DeviceProviderEvent from "../../provider/deviceProviderEvent.js";
import Logger from "../../../logging/Logger.js";
import SerialDeviceProvider from "../../provider/serialDeviceProvider.js";

export default class SlvCtrlPlusSerialDeviceProvider extends SerialDeviceProvider
{
    public static readonly name = 'slvCtrlPlusSerial';

    private static readonly moduleReadyByte = 0x07;

    private static readonly arduinoVendorId = '2341';

    private connectedDevices: Map<string, Device> = new Map();

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

    public async connectToDevice(portInfo: PortInfo): Promise<boolean> {
        if (portInfo.vendorId === SlvCtrlPlusSerialDeviceProvider.arduinoVendorId) {
            // It's an arduino
            return this.addArduinoSerialDevice(portInfo);
        } else {
            // It's something else
            return this.addOtherSerialDevice(portInfo);
        }
    }

    private async addOtherSerialDevice(portInfo: PortInfo): Promise<boolean>
    {
        const port = new SerialPort({ path: portInfo.path, baudRate: 9600, autoOpen: false });

        port.once('error', err => this.logger.error(err.message, err));

        try {
            await new Promise<void>((resolve, reject) => {
                port.open(err => err ? reject(err) : resolve());
            });

            this.logger.info('Connection opened for device: ' + portInfo.path);

            await this.connectSerialDevice(port, portInfo);
            return true;

        } catch (err) {
            port.close();
            this.logger.error(
                'Error in communication with device ' + portInfo.path + ': ' + (err as Error).message,
                err
            );
            return false;
        }
    }

    private addArduinoSerialDevice(portInfo: PortInfo): Promise<boolean>
    {
        return new Promise((resolve, reject) => {
            const port = new SerialPort({path: portInfo.path, baudRate: 9600, autoOpen: false });
            const readyParser = port.pipe(new ReadyParser({delimiter: [SlvCtrlPlusSerialDeviceProvider.moduleReadyByte]}));

            port.on('error', err => this.logger.error(err.message, err));

            // slvCtrl specific code (device type detection, etc)
            const readyHandler = () => {
                this.logger.debug('Received ready bytes from serial device');
                readyParser.removeListener('ready', readyHandler);
                port.unpipe(readyParser);

                this.connectSerialDevice(port, portInfo)
                    .then(() => resolve(true))
                    .catch((err: Error) => {
                        port.close();
                        this.logger.error(
                            'Error in communication with device ' + portInfo.path + ': ' + err.message,
                            err
                        );
                        resolve(false);
                    });
            };

            readyParser.on('ready', readyHandler);

            // Generic usb-serial device code
            port.open((err: Error) => {
                if (null !== err) {
                    reject(err);
                    return;
                }

                this.logger.info('Connection opened for device: ' + portInfo.path);
            });
        });
    }

    private async connectSerialDevice(port: SerialPort, portInfo: PortInfo): Promise<void>
    {
        const parser = port.pipe(new ReadlineParser({delimiter: '\n'}));
        const syncPort = new SynchronousSerialPort(portInfo, parser, port, this.logger);

        this.logger.debug(`Ask serial device for introduction (${portInfo.serialNumber})`, portInfo);
        await syncPort.writeAndExpect("clear\n", 250);
        const result = await syncPort.writeAndExpect("introduce\n", 250);
        this.logger.info(`Module detected: ${result} (${portInfo.serialNumber})`);

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
    }
}
