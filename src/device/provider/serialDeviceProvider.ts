import DeviceProvider from './deviceProvider.js';
import EventEmitter from 'events';
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
        eventEmitter: EventEmitter,
        logger: Logger
    ) {
        super(deviceManager, eventEmitter, logger);

        this.serialPortFactory = serialPortFactory;
        this.serialPortObserver = serialPortObserver;
    }

    public override async init(): Promise<void> {
        await super.init();
        await this.serialPortObserver.start();
    }

    public override async stop(): Promise<void> {
        await super.stop();
        await this.serialPortObserver.stop();
    }

    protected override canHandleDeviceDetectionInfo(deviceInfo: DeviceDetectionInfo): deviceInfo is SerialDeviceDetectionInfo {
        return deviceInfo.type === 'serial';
    }

    protected override async createDevice(deviceInfo: SerialDeviceDetectionInfo): Promise<D | undefined> {
        const portInfo = deviceInfo.portInfo;

        this.logger.info(`Connection attempt for serial device '${portInfo.path}' (s/n: ${portInfo.serialNumber})`);

        const port = this.serialPortFactory.create({
            path: portInfo.path,
            autoOpen: false,
            ...this.getSerialDeviceProviderPortOpenOptions(portInfo)
        });

        let device: D | undefined;
        let attemptFailureReason = 'unknown';

        try {
            await new Promise<void>((resolve, reject) => {
                port.open(err => err ? reject(err) : resolve());
            });

            await this.preparePort(port, portInfo);

            device = await this.connectSerialDevice(deviceInfo, port);
        } catch(e: unknown) {
            if (undefined !== device) {
                try {
                    await device.close();
                } catch (closeError: unknown) {
                    logError(this.logger, `Failed to close partially registered serial device '${portInfo.path}'`, closeError);
                }
            }
            const error = BaseError.normalize(e);
            attemptFailureReason = error.message;
        }

        if (undefined === device) {
            if (port.isOpen) {
                await new Promise<void>((resolve, reject) => {
                    port.close(err => err ? reject(err) : resolve());
                });
            }
            this.logger.info(`Could not connect to serial device '${portInfo.path}': ${attemptFailureReason}`);
        } else {
            this.logger.info(`Successfully connected to serial device '${portInfo.path}'`);
            this.logger.debug(`Assigned device id: ${device.getDeviceId} (${portInfo.path})`);
        }

        return device;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected preparePort(port: SerialPortStream<BindingInterface>, portInfo: PortInfo): Promise<void> {
        return Promise.resolve();
    }

    protected abstract connectSerialDevice(deviceInfo: SerialDeviceDetectionInfo, port: SerialPortStream<BindingInterface>): Promise<D | undefined>;

    protected abstract getSerialDeviceProviderPortOpenOptions(portInfo: PortInfo): SerialDeviceProviderPortOpenOptions;
}
