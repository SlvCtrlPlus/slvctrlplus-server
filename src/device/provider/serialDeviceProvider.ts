import DetectedDeviceProvider from './detectedDeviceProvider.js';
import EventEmitter from 'events';
import Logger from '../../logging/Logger.js';
import { BindingInterface, PortInfo } from '@serialport/bindings-interface';
import { SerialPortOpenOptions } from 'serialport';
import { SerialPortStream } from '@serialport/stream';
import SerialPortFactory from '../../factory/serialPortFactory.js';
import { AutoDetectTypes } from '@serialport/bindings-cpp';
import BaseError from 'modern-errors';
import DeviceManager, { DeviceInfo } from '../deviceManager.js';
import { logError } from '../../util/error.js';
import { SerialDeviceInfo } from '../transport/serialPortObserver.js';
import PeripheralDevice, { InferPeripheralDeviceAttributes, InferPeripheralDeviceConfig } from '../peripheralDevice.js';
import { DeviceAttributes, InferDeviceNotifications } from '../device.js';
import { AnyDeviceConfig } from '../deviceConfig.js';

export type SerialDeviceProviderPortOpenOptions = Omit<SerialPortOpenOptions<AutoDetectTypes>, 'path' | 'autoOpen'>;

export default abstract class SerialDeviceProvider<
    D extends PeripheralDevice<any, TAttributes, any, TConfig>,
    TAttributes extends DeviceAttributes = InferPeripheralDeviceAttributes<D>,
    TConfig extends AnyDeviceConfig = InferPeripheralDeviceConfig<D>
> extends DetectedDeviceProvider<SerialDeviceInfo, TAttributes, InferDeviceNotifications<D>, TConfig, D>
{
    private readonly serialPortFactory: SerialPortFactory;

    protected constructor(
        deviceManager: DeviceManager,
        serialPortFactory: SerialPortFactory,
        eventEmitter: EventEmitter,
        logger: Logger
    ) {
        super(deviceManager, eventEmitter, logger);

        this.serialPortFactory = serialPortFactory;
    }

    protected override supportsDeviceInfo(deviceInfo: DeviceInfo): deviceInfo is SerialDeviceInfo {
        return deviceInfo.type === 'serial';
    }

    protected override async createDevice(deviceInfo: SerialDeviceInfo): Promise<D | undefined> {
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

    protected abstract connectSerialDevice(deviceInfo: DeviceInfo, port: SerialPortStream<BindingInterface>): Promise<D | undefined>;

    protected abstract getSerialDeviceProviderPortOpenOptions(portInfo: PortInfo): SerialDeviceProviderPortOpenOptions;
}
