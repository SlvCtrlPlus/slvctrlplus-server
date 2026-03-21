import { ReadlineParser, SerialPort } from 'serialport';
import EventEmitter from 'events';
import Logger from '../../../logging/Logger.js';
import SerialDeviceProvider, { SerialDeviceProviderPortOpenOptions } from '../../provider/serialDeviceProvider.js';
import EStim2bProtocol from './estim2bProtocol.js';
import EStim2bDeviceFactory from './estim2bDeviceFactory.js';
import SerialPortFactory from '../../../factory/serialPortFactory.js';
import Estim2bDevice from './estim2bDevice.js';
import SynchronousSerialPort from '../../../serial/synchronousSerialPort.js';
import SerialDeviceTransportFactory from '../../transport/serialDeviceTransportFactory.js';
import { getErrorFromDecodeResult } from '../deviceProtocol.js';
import DeviceManager from '../../deviceManager.js';
import { SerialDeviceInfo } from '../../transport/serialPortObserver.js';

export default class EStim2bSerialDeviceProvider extends SerialDeviceProvider<Estim2bDevice>
{
    public static readonly providerName = 'estim2bSerial';

    private readonly transportFactory: SerialDeviceTransportFactory;

    private readonly deviceFactory: EStim2bDeviceFactory;

    public constructor(
        deviceManager: DeviceManager,
        serialPortFactory: SerialPortFactory,
        transportFactory: SerialDeviceTransportFactory,
        eventEmitter: EventEmitter,
        deviceFactory: EStim2bDeviceFactory,
        logger: Logger
    ) {
        super(deviceManager, serialPortFactory, eventEmitter, logger.child({ name: EStim2bSerialDeviceProvider.name }));

        this.transportFactory = transportFactory;
        this.deviceFactory = deviceFactory;
    }

    protected async connectSerialDevice(deviceInfo: SerialDeviceInfo, port: SerialPort): Promise<Estim2bDevice | undefined> {
        const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
        const syncPort = new SynchronousSerialPort(deviceInfo.portInfo, parser, port, this.logger);
        const transport = this.transportFactory.create(syncPort, undefined, Buffer.from('\r'));
        const estim2bProtocol = new EStim2bProtocol();

        const encodedMessage = estim2bProtocol.encode(estim2bProtocol.createGetStatusCommand());
        const response = await transport.sendAndAwaitReceive(encodedMessage);
        const decodedResponse = estim2bProtocol.decode(response);

        if ('error' in decodedResponse) {
            throw getErrorFromDecodeResult(decodedResponse.error, response);
        }

        const status = decodedResponse.message;

        this.logger.info(`Module detected: E-Stim Systems 2B ${status.firmwareVersion} (${deviceInfo.portInfo.serialNumber})`);

        const device = await this.deviceFactory.create(
            deviceInfo.id,
            estim2bProtocol,
            transport,
            status,
            EStim2bSerialDeviceProvider.providerName
        );

        return device;
    }

    protected getSerialDeviceProviderPortOpenOptions(): SerialDeviceProviderPortOpenOptions {
        return { baudRate: 9600 };
    }
}
