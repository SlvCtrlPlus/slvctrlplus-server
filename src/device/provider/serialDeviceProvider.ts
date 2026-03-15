import DeviceProvider from './deviceProvider.js';
import EventEmitter from 'events';
import Logger from '../../logging/Logger.js';
import { PortInfo } from '@serialport/bindings-interface';
import { SerialPort, SerialPortOpenOptions } from 'serialport';
import SerialPortFactory from '../../factory/serialPortFactory.js';
import { AutoDetectTypes } from '@serialport/bindings-cpp';
import BaseError from 'modern-errors';
import DeviceManager, { DeviceInfo, DeviceManagerEvent } from '../deviceManager.js';
import PeripheralDevice, { InferPeripheralDeviceAttributes, InferPeripheralDeviceConfig } from '../peripheralDevice.js';
import { AnyDeviceConfig } from '../deviceConfig.js';
import { DeviceAttributes } from '../device.js';
import { asyncHandler } from '../../util/async.js';
import { logError } from '../../util/error.js';
import { SerialDeviceInfo } from '../transport/serialPortObserver.js';

export type SerialDeviceProviderPortOpenOptions = Omit<SerialPortOpenOptions<AutoDetectTypes>, 'path' | 'autoOpen'>;

export default abstract class SerialDeviceProvider<
    D extends PeripheralDevice<any, TAttributes, TConfig>,
    TAttributes extends DeviceAttributes = InferPeripheralDeviceAttributes<D>,
    TConfig extends AnyDeviceConfig = InferPeripheralDeviceConfig<D>
> extends DeviceProvider<D, TAttributes, TConfig>
{
    private readonly serialPortFactory: SerialPortFactory;

    protected constructor(deviceManager: DeviceManager, serialPortFactory: SerialPortFactory, eventEmitter: EventEmitter, logger: Logger) {
        super(deviceManager, eventEmitter, logger);

        this.serialPortFactory = serialPortFactory;

        this.deviceManager.on(
            DeviceManagerEvent.deviceDetected,
            asyncHandler(
                this.handleDeviceDetection.bind(this),
                (err: unknown) => logError(this.logger, 'Error in device detection handler', err)
            )
        );
    }

    private async handleDeviceDetection(deviceInfo: DeviceInfo): Promise<void> {
        if (!this.isSerialDeviceInfo(deviceInfo)) {
            return;
        }

        this.logger.debug(`Requesting to acquire device: ${deviceInfo.id}`);

        const acquireResult = await this.deviceManager.acquireDetectedDevice(deviceInfo.id);

        if (!acquireResult.successful) {
            this.logger.debug(`Could not acquire device: ${acquireResult.reason}`);
            return;
        }

        try {
            const device = await this.connectToDevice(deviceInfo.portInfo);

            if (undefined === device) {
                this.deviceManager.releaseDetectedDevice(deviceInfo.id);
                return;
            }

            this.deviceManager.addDevice(device);
            this.deviceManager.claimDetectedDevice(deviceInfo.id);
        } catch (e: unknown) {
            logError(this.logger, `Error while connecting to device`, e);
            this.deviceManager.releaseDetectedDevice(deviceInfo.id);
        }
    }

    private isSerialDeviceInfo(deviceInfo: DeviceInfo): deviceInfo is SerialDeviceInfo
    {
        return 'portInfo' in deviceInfo;
    }

    public async connectToDevice(portInfo: PortInfo): Promise<D | undefined> {
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

            device = await this.connectSerialDevice(port, portInfo);
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
        }

        return device;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected preparePort(port: SerialPort, portInfo: PortInfo): Promise<void> {
        return Promise.resolve();
    }

    protected abstract connectSerialDevice(port: SerialPort, portInfo: PortInfo): Promise<D | undefined>;

    protected abstract getSerialDeviceProviderPortOpenOptions(portInfo: PortInfo): SerialDeviceProviderPortOpenOptions;
}
