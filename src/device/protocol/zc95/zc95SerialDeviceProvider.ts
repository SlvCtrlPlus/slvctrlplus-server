import { SerialPort } from 'serialport';
import { PortInfo } from '@serialport/bindings-interface';
import EventEmitter from 'events';
import Logger from '../../../logging/Logger.js';
import { Zc95Serial } from './Zc95Serial.js';
import { MsgResponse, Zc95MessageFactory } from './Zc95MessageFactory.js';
import SerialDeviceProvider, { SerialDeviceProviderPortOpenOptions } from '../../provider/serialDeviceProvider.js';
import Zc95DeviceFactory from './zc95DeviceFactory.js';
import DeviceProviderEvent from '../../provider/deviceProviderEvent.js';
import Zc95Device from './zc95Device.js';
import SerialPortFactory from '../../../factory/serialPortFactory.js';
import { FrameParser } from './FrameParser.js';
import SerialDeviceTransport from '../../transport/serialDeviceTransport.js';
import SynchronousSerialPort from '../../../serial/SynchronousSerialPort.js';

export default class Zc95SerialDeviceProvider extends SerialDeviceProvider
{
    public static readonly providerName = 'zc95Serial';

    private connectedDevices: Map<string, Zc95Device> = new Map();

    private readonly deviceFactory: Zc95DeviceFactory;

    public constructor(
        serialPortFactory: SerialPortFactory,
        eventEmitter: EventEmitter,
        deviceFactory: Zc95DeviceFactory,
        logger: Logger
    ) {
        super(serialPortFactory, eventEmitter, logger.child({ name: Zc95SerialDeviceProvider.name }));

        this.deviceFactory = deviceFactory;
    }

    protected async connectSerialDevice(port: SerialPort, portInfo: PortInfo): Promise<boolean> {
        const serialLogger = this.logger.child({ name: Zc95Serial.name })
        const receiveQueue: MsgResponse[] = [];

        const parser = port.pipe(new FrameParser({ stx: 0x02, etx: 0x03 }));
        const serialPort = new SynchronousSerialPort(portInfo, parser, port, serialLogger);
        const transport = new SerialDeviceTransport(serialPort);

        this.logger.debug(`Reset device connection`);
        await zc95Serial.reset(false);
        const versionDetails = await zc95Messages.getVersionDetails();

        if (undefined === versionDetails) {
            throw new Error(`Could not obtain version details`);
        }

        this.logger.info(`Module detected: ZC95 ${versionDetails.ZC95} (${portInfo.serialNumber})`);

        const device = await this.deviceFactory.create(
            versionDetails,
            transport,
            Zc95SerialDeviceProvider.providerName
        );

        const deviceStatusUpdaterInterval = this.initDeviceStatusUpdater(device);

        this.connectedDevices.set(device.getDeviceId, device);

        this.eventEmitter.emit(DeviceProviderEvent.deviceConnected, device);

        this.logger.debug(`Assigned device id: ${device.getDeviceId} (${portInfo.path})`);
        this.logger.info('Connected devices: ' + this.connectedDevices.size.toString());

        port.on('close', () => {
            clearInterval(deviceStatusUpdaterInterval);
            this.connectedDevices.delete(device.getDeviceId);

            this.eventEmitter.emit(DeviceProviderEvent.deviceDisconnected, device);

            this.logger.info('Lost serial device: ' + device.getDeviceId);
            this.logger.info('Connected ZC95 serial devices: ' + this.connectedDevices.size.toString());
        });

        return true;
    }

    protected getSerialDeviceProviderPortOpenOptions(): SerialDeviceProviderPortOpenOptions {
        return { baudRate: 115200 };
    }
}
