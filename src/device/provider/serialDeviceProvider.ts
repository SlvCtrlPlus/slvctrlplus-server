import DeviceProvider from './deviceProvider.js';
import Logger from '../../logging/Logger.js';
import { BindingInterface, PortInfo } from '@serialport/bindings-interface';
import { SerialPortOpenOptions } from 'serialport';
import { SerialPortStream } from '@serialport/stream';
import SerialPortFactory from '../../factory/serialPortFactory.js';
import { AutoDetectTypes } from '@serialport/bindings-cpp';
import BaseError from 'modern-errors';
import DeviceManager, { DeviceDetectionInfo } from '../deviceManager.js';
import { logError } from '../../util/error.js';
import SerialPortObserver, { SerialDeviceDetectionInfo } from '../transport/serialPortObserver.js';
import { AnyPeripheralDevice } from '../peripheralDevice.js';

export type SerialDeviceProviderPortOpenOptions = Omit<SerialPortOpenOptions<AutoDetectTypes>, 'path' | 'autoOpen'>;

export default abstract class SerialDeviceProvider<D extends AnyPeripheralDevice> extends DeviceProvider<SerialDeviceDetectionInfo, D>
{
    private readonly serialPortFactory: SerialPortFactory;

    private readonly serialPortObserver: SerialPortObserver;

    protected constructor(
        deviceManager: DeviceManager,
        serialPortFactory: SerialPortFactory,
        serialPortObserver: SerialPortObserver,
        logger: Logger,
    ) {
        super(deviceManager, logger);

        this.serialPortFactory = serialPortFactory;
        this.serialPortObserver = serialPortObserver;
    }

    protected override async doStart(): Promise<void> {
        await this.serialPortObserver.start();
    }

    protected override async doStop(): Promise<void> {
        await this.serialPortObserver.stop();
    }

    protected override canHandleDeviceDetectionInfo(deviceDetectionInfo: DeviceDetectionInfo): deviceDetectionInfo is SerialDeviceDetectionInfo {
        return deviceDetectionInfo.type === 'serial';
    }

    protected override async createDevice(deviceDetectionInfo: SerialDeviceDetectionInfo): Promise<D> {
        const portInfo = deviceDetectionInfo.portInfo;

        this.logger.info(`Connection attempt for serial device '${portInfo.path}' (s/n: ${portInfo.serialNumber})`);

        const port = this.serialPortFactory.create({
            path: portInfo.path,
            autoOpen: false,
            ...this.getSerialDeviceProviderPortOpenOptions(portInfo),
        });

        try {
            await new Promise<void>((resolve, reject) => {
                port.open(err => err ? reject(err) : resolve());
            });

            await this.preparePort(port, portInfo);

            const device = await this.connectSerialDevice(deviceDetectionInfo, port);

            this.logger.info(`Successfully connected to serial device '${portInfo.path}'`);
            this.logger.debug(`Assigned device id: ${device.getDeviceId} (${portInfo.path})`);

            return device;
        } catch (e: unknown) {
            if (port.isOpen) {
                try {
                    await new Promise<void>((resolve, reject) => {
                        port.close(err => err ? reject(err) : resolve());
                    });
                } catch (closeError: unknown) {
                    logError(this.logger, `Failed to close serial port '${portInfo.path}' after a failed connection attempt`, closeError);
                }
            }

            const error = BaseError.normalize(e);
            this.logger.info(`Could not connect to serial device '${portInfo.path}': ${error.message}`);

            throw e;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected preparePort(port: SerialPortStream<BindingInterface>, portInfo: PortInfo): Promise<void> {
        return Promise.resolve();
    }

    protected abstract connectSerialDevice(deviceDetectionInfo: SerialDeviceDetectionInfo, port: SerialPortStream<BindingInterface>): Promise<D>;

    protected abstract getSerialDeviceProviderPortOpenOptions(portInfo: PortInfo): SerialDeviceProviderPortOpenOptions;
}
