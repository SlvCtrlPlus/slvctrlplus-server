import { ReadlineParser, ReadyParser, SerialPort } from 'serialport';
import type { PortInfo } from '@serialport/bindings-interface';
import Device from '../../device.js';
import SlvCtrlPlusDeviceFactory from './slvCtrlPlusDeviceFactory.js';
import SynchronousSerialPort from '../../../serial/SynchronousSerialPort.js';
import EventEmitter from 'events';
import SerialDeviceTransportFactory from '../../transport/serialDeviceTransportFactory.js';
import DeviceProviderEvent from '../../provider/deviceProviderEvent.js';
import Logger from '../../../logging/Logger.js';
import SerialDeviceProvider, { SerialDeviceProviderPortOpenOptions } from '../../provider/serialDeviceProvider.js';
import SerialPortFactory from '../../provider/serialPortFactory.js';
import { clearInterval } from 'node:timers';

export default class SlvCtrlPlusSerialDeviceProvider extends SerialDeviceProvider
{
    public static readonly providerName = 'slvCtrlPlusSerial';

    private static readonly moduleReadyByte = 0x07;

    private static readonly arduinoVendorId = '2341';

    private connectedDevices: Map<string, Device> = new Map();

    private readonly slvCtrlPlusDeviceFactory: SlvCtrlPlusDeviceFactory;

    private readonly deviceTransportFactory: SerialDeviceTransportFactory;

    public constructor(
        serialPortFactory: SerialPortFactory,
        eventEmitter: EventEmitter,
        deviceFactory: SlvCtrlPlusDeviceFactory,
        deviceTransportFactory: SerialDeviceTransportFactory,
        logger: Logger
    ) {
        super(serialPortFactory, eventEmitter, logger.child({ name: SlvCtrlPlusSerialDeviceProvider.name }));
        this.slvCtrlPlusDeviceFactory = deviceFactory;
        this.deviceTransportFactory = deviceTransportFactory;
    }

    protected async connectSerialDevice(port: SerialPort, portInfo: PortInfo): Promise<boolean> {
        const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
        const syncPort = new SynchronousSerialPort(portInfo, parser, port, this.logger);

        this.logger.debug(`Ask serial device for introduction (${portInfo.serialNumber})`, portInfo);
        await syncPort.writeAndExpect('clear\n', 250);
        const result = await syncPort.writeAndExpect('introduce\n', 250);
        this.logger.info(`Module detected: ${result} (${portInfo.serialNumber})`);

        const transport = this.deviceTransportFactory.create(syncPort);
        const device = await this.slvCtrlPlusDeviceFactory.create(
            result,
            transport,
            SlvCtrlPlusSerialDeviceProvider.providerName
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

        return true;
    }

    protected getSerialDeviceProviderPortOpenOptions(): SerialDeviceProviderPortOpenOptions {
        return { baudRate: 9600 };
    }

    protected preparePort(port: SerialPort, portInfo: PortInfo) {
        if (portInfo.vendorId !== SlvCtrlPlusSerialDeviceProvider.arduinoVendorId) {
            // It's NOT an Arduino
            return;
        }

        const readyParser = port.pipe(new ReadyParser({
            delimiter: [SlvCtrlPlusSerialDeviceProvider.moduleReadyByte]
        }));

        port.on('error', err => this.logger.error(err.message, err));

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
    }
}
