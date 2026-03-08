import DeviceProvider from './deviceProvider.js';
import EventEmitter from 'events';
import Logger from '../../logging/Logger.js';
import SerialPortObserver from '../transport/serialPortObserver.js';
import { PortInfo } from '@serialport/bindings-interface';
import { SerialPort, SerialPortOpenOptions } from 'serialport';
import SerialPortFactory from '../../factory/serialPortFactory.js';
import { AutoDetectTypes } from '@serialport/bindings-cpp';
import BaseError from 'modern-errors';
import DeviceManager, { DeviceInfo, SerialDeviceInfo } from '../deviceManager.js';
import Device from '../device.js';

export type SerialDeviceProviderPortOpenOptions = Omit<SerialPortOpenOptions<AutoDetectTypes>, 'path' | 'autoOpen'>;

export default abstract class SerialDeviceProvider extends DeviceProvider
{
    private readonly serialPortFactory: SerialPortFactory;

    protected readonly deviceManager: DeviceManager;

    protected constructor(deviceManager: DeviceManager, serialPortFactory: SerialPortFactory, eventEmitter: EventEmitter, logger: Logger) {
        super(eventEmitter, logger);

        this.deviceManager = deviceManager;
        this.serialPortFactory = serialPortFactory;

        this.deviceManager.on('deviceAvailable', async (deviceInfo: DeviceInfo) => {
            if (!this.isSerialDeviceInfo(deviceInfo)) {
                return;
            }

            await this.deviceManager.claimAvailableDevice(deviceInfo.id);
            const device = await this.connectToDevice(deviceInfo.portInfo);

            if (!device) {
                this.deviceManager.freeClaimedDevice(deviceInfo.id);
                return;
            }

            this.deviceManager.addDevice(device);
        });
    }

    private isSerialDeviceInfo(deviceInfo: DeviceInfo): deviceInfo is SerialDeviceInfo
    {
        return 'portInfo' in deviceInfo;
    }

    public async connectToDevice(portInfo: PortInfo): Promise<Device | undefined>{
        this.logger.info(`Connection attempt for serial device '${portInfo.path}' (s/n: ${portInfo.serialNumber})`);

        const port = this.serialPortFactory.create({
            path: portInfo.path,
            autoOpen: false,
            ...this.getSerialDeviceProviderPortOpenOptions(portInfo)
        });

        let result;
        let attemptFailureReason = 'unknown';

        try {
            await new Promise<void>((resolve, reject) => {
                port.open(err => err ? reject(err) : resolve());
            });

            await this.preparePort(port, portInfo);

            result = await this.connectSerialDevice(port, portInfo);
        } catch(e: unknown) {
            const error = BaseError.normalize(e);
            attemptFailureReason = error.message;
        }

        if (undefined === result) {
            if (port.isOpen) {
                port.close();
            }
            this.logger.info(`Could not connect to serial device '${portInfo.path}': ${attemptFailureReason}`);
        } else {
            this.logger.info(`Successfully connected to serial device '${portInfo.path}'`);
        }

        return result;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected preparePort(port: SerialPort, portInfo: PortInfo): Promise<void> {
        return Promise.resolve();
    }

    protected abstract connectSerialDevice(port: SerialPort, portInfo: PortInfo): Promise<Device | undefined>;

    protected abstract getSerialDeviceProviderPortOpenOptions(portInfo: PortInfo): SerialDeviceProviderPortOpenOptions;

    public registerAtObserver(observer: SerialPortObserver): void {
        observer.addDeviceProvider(this);
    }
}
