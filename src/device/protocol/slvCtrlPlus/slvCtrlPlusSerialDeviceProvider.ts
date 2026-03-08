import { ReadlineParser, ReadyParser, SerialPort } from 'serialport';
import type { PortInfo } from '@serialport/bindings-interface';
import Device from '../../device.js';
import SlvCtrlPlusDeviceFactory from './slvCtrlPlusDeviceFactory.js';
import SynchronousSerialPort from '../../../serial/synchronousSerialPort.js';
import EventEmitter from 'events';
import SerialDeviceTransportFactory from '../../transport/serialDeviceTransportFactory.js';
import DeviceProviderEvent from '../../provider/deviceProviderEvent.js';
import Logger from '../../../logging/Logger.js';
import SerialDeviceProvider, { SerialDeviceProviderPortOpenOptions } from '../../provider/serialDeviceProvider.js';
import SerialPortFactory from '../../../factory/serialPortFactory.js';
import { clearInterval } from 'node:timers';
import BaseError from 'modern-errors';
import SlvCtrlProtocol from './slvCtrlProtocol.js';
import DeviceTransport from '../../../device/transport/deviceTransport.js';
import DeviceManager from '../../deviceManager.js';

export default class SlvCtrlPlusSerialDeviceProvider extends SerialDeviceProvider
{
    public static readonly providerName = 'slvCtrlPlusSerial';

    private static readonly moduleReadyByte = 0x07;

    private static readonly arduinoVendorId = '2341';

    private connectedDevices: Map<string, Device> = new Map();

    private readonly slvCtrlPlusDeviceFactory: SlvCtrlPlusDeviceFactory;

    private readonly deviceTransportFactory: SerialDeviceTransportFactory;

    public constructor(
        deviceManager: DeviceManager,
        serialPortFactory: SerialPortFactory,
        eventEmitter: EventEmitter,
        deviceFactory: SlvCtrlPlusDeviceFactory,
        deviceTransportFactory: SerialDeviceTransportFactory,
        logger: Logger
    ) {
        super(deviceManager, serialPortFactory, eventEmitter, logger.child({ name: SlvCtrlPlusSerialDeviceProvider.name }));
        this.slvCtrlPlusDeviceFactory = deviceFactory;
        this.deviceTransportFactory = deviceTransportFactory;
    }

    protected async connectSerialDevice(port: SerialPort, portInfo: PortInfo): Promise<Device | undefined> {
        const parser = port.pipe(new ReadlineParser({ delimiter: SlvCtrlProtocol.EOF }));
        const syncPort = new SynchronousSerialPort(portInfo, parser, port, this.logger);
        const transport = this.deviceTransportFactory.create(syncPort, undefined, Buffer.from(SlvCtrlProtocol.EOF));

        await this.performHandshakeWithRetries(transport, 4);

        const device = await this.slvCtrlPlusDeviceFactory.create(
            transport,
            SlvCtrlPlusSerialDeviceProvider.providerName
        );

        this.logger.info(`Module detected: ${device.getDeviceModel} (${portInfo.serialNumber})`);
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

        return device;
    }

    private async performHandshakeWithRetries(transport: DeviceTransport, maxAttempts: number): Promise<void> {
        let lastError;

        for (let i = 1; i <= maxAttempts; i++) {
            try {
                await transport.sendAndAwaitReceive(Buffer.from(`clear`), 250);
                return;
            } catch(e: unknown) {
                const error = BaseError.normalize(e);
                this.logger.info(`Retrying because handshake attempt ${i} failed: ${error.message}`);
                if (i === maxAttempts) lastError = e;
            }
        }

        throw lastError;
    }

    protected getSerialDeviceProviderPortOpenOptions(): SerialDeviceProviderPortOpenOptions {
        return { baudRate: 9600 };
    }

    protected preparePort(port: SerialPort, portInfo: PortInfo): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (portInfo.vendorId !== SlvCtrlPlusSerialDeviceProvider.arduinoVendorId) {
                // It's NOT an Arduino
                resolve();
                return;
            }

            const readyParser = port.pipe(new ReadyParser({
                delimiter: [SlvCtrlPlusSerialDeviceProvider.moduleReadyByte]
            }));

            // Let's timeout if we don't receive the ready bytes for a few seconds
            const timeout = setTimeout(() => {
                port.unpipe(readyParser);
                readyParser.destroy();
                reject(new Error(`Timed out while waiting for ready bytes`));
            }, 3000);

            readyParser.once('ready', () => {
                clearTimeout(timeout);
                port.unpipe(readyParser);
                readyParser.destroy();
                resolve();
            });
        });
    }
}
