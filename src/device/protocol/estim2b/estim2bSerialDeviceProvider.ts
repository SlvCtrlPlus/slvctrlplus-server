import { SerialPort } from 'serialport';
import { PortInfo } from '@serialport/bindings-interface';
import EventEmitter from 'events';
import Logger from '../../../logging/Logger.js';
import SerialDeviceProvider, { SerialDeviceProviderPortOpenOptions } from '../../provider/serialDeviceProvider.js';
import DeviceProviderEvent from '../../provider/deviceProviderEvent.js';
import EStim2bProtocol, { EStim2bStatus } from './estim2bProtocol.js';
import EStim2bDeviceFactory from './estim2bDeviceFactory.js';
import SerialPortFactory from '../../provider/serialPortFactory.js';
import Estim2bDevice from './estim2bDevice.js';

export default class EStim2bSerialDeviceProvider extends SerialDeviceProvider
{
    public static readonly providerName = 'estim2bSerial';

    private connectedDevices: Map<string, Estim2bDevice> = new Map();

    private readonly deviceFactory: EStim2bDeviceFactory;

    public constructor(
        serialPortFactory: SerialPortFactory,
        eventEmitter: EventEmitter,
        deviceFactory: EStim2bDeviceFactory,
        logger: Logger
    ) {
        super(serialPortFactory, eventEmitter, logger.child({ name: EStim2bSerialDeviceProvider.name }));

        this.deviceFactory = deviceFactory;
    }

    private performIntroduction(estim2bProtocol: EStim2bProtocol): Promise<EStim2bStatus> {
        return new Promise<EStim2bStatus>((resolve, reject) => {
            const handler = (status: EStim2bStatus) => {
                estim2bProtocol.off('statusUpdated', handler);
                resolve(status);
            };
            estim2bProtocol.on('statusUpdated', handler);
            estim2bProtocol.requestStatus();
            // Clean up on timeout
            setTimeout(() => {
                estim2bProtocol.off('statusUpdated', handler);
                reject(new Error('Timeout (>500ms) waiting for status message'));
            }, 500);
        });
    }

    protected async connectSerialDevice(port: SerialPort, portInfo: PortInfo): Promise<boolean> {
        const estim2bProtocol = new EStim2bProtocol(port, new EventEmitter());

        try {
            this.logger.debug(`Ask serial device for introduction (${portInfo.serialNumber})`, portInfo);
            const status = await this.performIntroduction(estim2bProtocol);

            this.logger.info(`Module detected: E-Stim Systems 2B ${status.firmwareVersion} (${portInfo.serialNumber})`);

            const device = await this.deviceFactory.create(
                estim2bProtocol,
                status,
                EStim2bSerialDeviceProvider.providerName
            );

            this.connectedDevices.set(device.getDeviceId, device);

            this.eventEmitter.emit(DeviceProviderEvent.deviceConnected, device);

            this.logger.debug(`Assigned device id: ${device.getDeviceId} (${portInfo.path})`);
            this.logger.info('Connected devices: ' + this.connectedDevices.size.toString());

            port.on('close', () => {
                this.connectedDevices.delete(device.getDeviceId);

                this.eventEmitter.emit(DeviceProviderEvent.deviceDisconnected, device);

                this.logger.info('Lost serial device: ' + device.getDeviceId);
                this.logger.info('Connected ZC95 serial devices: ' + this.connectedDevices.size.toString());
            });

            return true;
        } catch (err: unknown) {
            this.logger.error(
                `Could not connect to serial device '${portInfo.path}': ${(err as Error).message}`,
                err
            );

            return false;
        }
    }

    protected getSerialDeviceProviderPortOpenOptions(): SerialDeviceProviderPortOpenOptions {
        return { baudRate: 9600 };
    }
}
