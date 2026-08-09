import { ReadlineParser, ReadyParser } from 'serialport';
import type { SerialPortStream } from '@serialport/stream';
import type { PortInfo } from '@serialport/bindings-interface';
import type SlvCtrlPlusDeviceFactory from './slvCtrlPlusDeviceFactory.js';
import SynchronousSerialPort from '../../../serial/synchronousSerialPort.js';
import type SerialDeviceTransportFactory from '../../transport/serialDeviceTransportFactory.js';
import type Logger from '../../../logging/Logger.js';
import type { SerialDeviceProviderPortOpenOptions } from '../../provider/serialDeviceProvider.js';
import SerialDeviceProvider from '../../provider/serialDeviceProvider.js';
import type SerialPortFactory from '../../../factory/serialPortFactory.js';
import BaseError from 'modern-errors';
import SlvCtrlProtocol from './slvCtrlProtocol.js';
import type DeviceBidirectionalTransport from '../../transport/deviceBidirectionalTransport.js';
import type DeviceManager from '../../deviceManager.js';
import type GenericSlvCtrlPlusDevice from './genericSlvCtrlPlusDevice.js';
import type { SerialDeviceDetectionInfo } from '../../transport/serialPortObserver.js';
import type SerialPortObserver from '../../transport/serialPortObserver.js';

export default class SlvCtrlPlusSerialDeviceProvider extends SerialDeviceProvider<GenericSlvCtrlPlusDevice>
{
    public static readonly providerName = 'slvCtrlPlusSerial';

    private static readonly SERIAL_READY_BYTE = 0x07;
    private static readonly SERIAL_READY_BYTE_TIMEOUT_MS = 3000;
    private static readonly HANDSHAKE_TIMEOUT_MS = 250;
    private static readonly HANDSHAKE_MAX_RETRIES = 4;

    private static readonly arduinoVendorId = '2341';

    private readonly slvCtrlPlusDeviceFactory: SlvCtrlPlusDeviceFactory;

    private readonly deviceTransportFactory: SerialDeviceTransportFactory;

    public constructor(
        deviceManager: DeviceManager,
        serialPortFactory: SerialPortFactory,
        serialPortObserver: SerialPortObserver,
        deviceFactory: SlvCtrlPlusDeviceFactory,
        deviceTransportFactory: SerialDeviceTransportFactory,
        logger: Logger,
    ) {
        super(deviceManager, serialPortFactory, serialPortObserver, logger.child({ name: SlvCtrlPlusSerialDeviceProvider.name }));
        this.slvCtrlPlusDeviceFactory = deviceFactory;
        this.deviceTransportFactory = deviceTransportFactory;
    }

    protected async connectSerialDevice(deviceDetectionInfo: SerialDeviceDetectionInfo, port: SerialPortStream): Promise<GenericSlvCtrlPlusDevice>
    {
        const parser = port.pipe(new ReadlineParser({ delimiter: SlvCtrlProtocol.EOF }));
        const syncPort = new SynchronousSerialPort(deviceDetectionInfo.portInfo, parser, port, this.logger);
        const transport = this.deviceTransportFactory.create(syncPort, undefined, Buffer.from(SlvCtrlProtocol.EOF));

        await this.performHandshakeWithRetries(transport, SlvCtrlPlusSerialDeviceProvider.HANDSHAKE_MAX_RETRIES);

        const device = await this.slvCtrlPlusDeviceFactory.create(
            deviceDetectionInfo.detectionId,
            transport,
            SlvCtrlPlusSerialDeviceProvider.providerName,
        );

        this.logger.info(`Module detected: ${device.getDeviceModel} (${deviceDetectionInfo.portInfo.serialNumber})`);

        return device;
    }

    protected override getSerialDeviceProviderPortOpenOptions(): SerialDeviceProviderPortOpenOptions {
        return { baudRate: 9600 };
    }

    protected override async preparePort(port: SerialPortStream, portInfo: PortInfo): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (portInfo.vendorId !== SlvCtrlPlusSerialDeviceProvider.arduinoVendorId) {
                // It's NOT an Arduino
                resolve();
                return;
            }

            const readyParser = port.pipe(new ReadyParser({
                delimiter: [SlvCtrlPlusSerialDeviceProvider.SERIAL_READY_BYTE],
            }));

            // Let's timeout if we don't receive the ready bytes for a few seconds
            const timeout = setTimeout(() => {
                port.unpipe(readyParser);
                readyParser.destroy();
                reject(new Error(`Timed out while waiting for ready bytes`));
            }, SlvCtrlPlusSerialDeviceProvider.SERIAL_READY_BYTE_TIMEOUT_MS);

            readyParser.once('ready', () => {
                clearTimeout(timeout);
                port.unpipe(readyParser);
                readyParser.destroy();
                resolve();
            });
        });
    }

    private async performHandshakeWithRetries(transport: DeviceBidirectionalTransport, maxAttempts: number): Promise<void> {
        let lastError;

        for (let i = 1; i <= maxAttempts; i++) {
            try {
                await transport.sendAndAwaitReceive(
                    Buffer.from(`clear`),
                    SlvCtrlPlusSerialDeviceProvider.HANDSHAKE_TIMEOUT_MS,
                );
                return;
            } catch (e: unknown) {
                const error = BaseError.normalize(e);
                this.logger.info(`Retrying because handshake attempt ${i} failed: ${error.message}`);
                if (i === maxAttempts) lastError = e;
            }
        }

        throw lastError;
    }
}
