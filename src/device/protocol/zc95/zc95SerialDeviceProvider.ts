import { SerialPort } from 'serialport';
import { PortInfo } from '@serialport/bindings-interface';
import EventEmitter from 'events';
import Logger from '../../../logging/Logger.js';
import SerialDeviceProvider, { SerialDeviceProviderPortOpenOptions } from '../../provider/serialDeviceProvider.js';
import Zc95DeviceFactory from './zc95DeviceFactory.js';
import DeviceProviderEvent from '../../provider/deviceProviderEvent.js';
import Zc95Device from './zc95Device.js';
import SerialPortFactory from '../../../factory/serialPortFactory.js';
import { FrameParser } from './FrameParser.js';
import SerialDeviceTransport from '../../transport/serialDeviceTransport.js';
import SynchronousSerialPort from '../../../serial/SynchronousSerialPort.js';
import Zc95Protocol from './zc95Protocol.js';
import MessageResponseHandler from '../messageResponseHandler.js';
import Zc95MessageFactory, { Msg, MsgAndResponseIdentifier, MsgResponse } from './zc95MessageFactory.js';

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
        const serialLogger = this.logger.child({ name: Zc95Device.name })

        const parser = port.pipe(new FrameParser({ stx: Zc95Protocol.STX, etx: Zc95Protocol.ETX }));
        const serialPort = new SynchronousSerialPort(portInfo, parser, port, serialLogger);
        const transport = new SerialDeviceTransport(serialPort);
        const protocol = new Zc95Protocol();
        const messageFactory = new Zc95MessageFactory();

        const messageResponseHandler = MessageResponseHandler.create(
            protocol,
            transport,
            (response: MsgResponse, message: MsgAndResponseIdentifier<Msg, MsgResponse>) => {
                return response.MsgId === message.responseIdentifier.msgId
                    && response.Type === message.responseIdentifier.type;
            }
        );

        this.logger.debug(`Reset device connection`);
        await this.reset(port, false);
        const versionDetails = await messageResponseHandler.send(messageFactory.createGetVersionDetails());

        this.logger.info(`Module detected: ZC95 ${versionDetails.ZC95} (${portInfo.serialNumber})`);

        const device = await this.deviceFactory.create(
            versionDetails,
            protocol,
            transport,
            messageFactory,
            messageResponseHandler,
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

    private async reset(port: SerialPort, close: boolean = false): Promise<void> {
        return new Promise(resolve => {
            port.write(Buffer.from([Zc95Protocol.EOT]), () => {
                if (close) port.close();
            });
            setTimeout(resolve, 250);
            this.logger.trace('> EOT');
        });
    }
}
