import type { SerialPortStream } from '@serialport/stream';
import type Logger from '../../../logging/Logger.js';
import type { SerialDeviceProviderPortOpenOptions } from '../../provider/serialDeviceProvider.js';
import SerialDeviceProvider from '../../provider/serialDeviceProvider.js';
import type Zc95DeviceFactory from './zc95DeviceFactory.js';
import Zc95Device from './zc95Device.js';
import type SerialPortFactory from '../../../factory/serialPortFactory.js';
import { FrameParser } from '../../../serial/frameParser.js';
import SynchronousSerialPort from '../../../serial/synchronousSerialPort.js';
import Zc95Protocol from './zc95Protocol.js';
import MessageResponseHandler from '../messageResponseHandler.js';
import Zc95MessageFactory from './zc95MessageFactory.js';
import type SerialDeviceTransportFactory from '../../transport/serialDeviceTransportFactory.js';
import type DeviceManager from '../../deviceManager.js';
import type { SerialDeviceDetectionInfo } from '../../transport/serialPortObserver.js';
import type SerialPortObserver from '../../transport/serialPortObserver.js';
import type JsonSchemaValidatorFactory from '../../../schemaValidation/JsonSchemaValidatorFactory.js';

export default class Zc95SerialDeviceProvider extends SerialDeviceProvider<Zc95Device>
{
    public static readonly providerName = 'zc95Serial';

    private static readonly EOT_SETTLE_DELAY_MS = 250;

    private readonly transportFactory: SerialDeviceTransportFactory;

    private readonly deviceFactory: Zc95DeviceFactory;

    private readonly jsonSchemaValidatorFactory: JsonSchemaValidatorFactory;

    public constructor(
        deviceManager: DeviceManager,
        serialPortFactory: SerialPortFactory,
        serialPortObserver: SerialPortObserver,
        transportFactory: SerialDeviceTransportFactory,
        deviceFactory: Zc95DeviceFactory,
        jsonSchemaValidatorFactory: JsonSchemaValidatorFactory,
        logger: Logger,
    ) {
        super(deviceManager, serialPortFactory, serialPortObserver, logger.child({ name: Zc95SerialDeviceProvider.name }));

        this.transportFactory = transportFactory;
        this.deviceFactory = deviceFactory;
        this.jsonSchemaValidatorFactory = jsonSchemaValidatorFactory;
    }

    protected async connectSerialDevice(deviceDetectionInfo: SerialDeviceDetectionInfo, port: SerialPortStream): Promise<Zc95Device> {
        const serialLogger = this.logger.child({ name: Zc95Device.name });

        const parser = port.pipe(new FrameParser({ stx: Zc95Protocol.STX, etx: Zc95Protocol.ETX }));
        const serialPort = new SynchronousSerialPort(deviceDetectionInfo.portInfo, parser, port, serialLogger);
        const transport = this.transportFactory.create(
            serialPort, Buffer.from([Zc95Protocol.STX]), Buffer.from([Zc95Protocol.ETX]),
        );
        const protocol = new Zc95Protocol(this.jsonSchemaValidatorFactory);
        const messageFactory = new Zc95MessageFactory();

        const messageResponseHandler = MessageResponseHandler.create(
            protocol,
            transport,
            this.logger,
        );

        this.logger.debug(`Reset device connection`);
        await this.reset(port, false);
        const versionDetails = await messageResponseHandler.send(messageFactory.createGetVersionDetails());

        this.logger.info(`Module detected: ZC95 ${versionDetails.ZC95} (${deviceDetectionInfo.portInfo.serialNumber})`);

        const device = await this.deviceFactory.create(
            deviceDetectionInfo.detectionId,
            versionDetails,
            protocol,
            transport,
            messageFactory,
            messageResponseHandler,
            Zc95SerialDeviceProvider.providerName,
        );

        return device;
    }

    protected override getSerialDeviceProviderPortOpenOptions(): SerialDeviceProviderPortOpenOptions {
        return { baudRate: 115200 };
    }

    private async reset(port: SerialPortStream, close = false): Promise<void> {
        return new Promise((resolve, reject) => {
            port.write(Buffer.from([Zc95Protocol.EOT]), (writeErr: Error | null | undefined) => {
                if (null != writeErr) {
                    reject(writeErr);
                    return;
                }

                this.logger.trace('> EOT');

                if (close) {
                    port.close((closeErr: Error | null) => {
                        if (null != closeErr) {
                            reject(closeErr);
                            return;
                        }
                        setTimeout(resolve, Zc95SerialDeviceProvider.EOT_SETTLE_DELAY_MS);
                    });
                } else {
                    setTimeout(resolve, Zc95SerialDeviceProvider.EOT_SETTLE_DELAY_MS);
                }
            });
        });
    }
}
