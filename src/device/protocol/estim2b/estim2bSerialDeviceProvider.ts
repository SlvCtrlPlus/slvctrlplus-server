import { SerialPort } from 'serialport';
import { PortInfo } from '@serialport/bindings-interface';
import EventEmitter from 'events';
import Logger from '../../../logging/Logger.js';
import { MsgResponse } from './Zc95Messages.js';
import SerialDeviceProvider from '../../provider/serialDeviceProvider.js';
import Zc95DeviceFactory from './zc95DeviceFactory.js';
import DeviceProviderEvent from '../../provider/deviceProviderEvent.js';
import Zc95Device from './zc95Device.js';
import EStim2bProtocol, { EStim2bStatus } from './estim2bProtocol.js';
import EStim2bDeviceFactory from './estim2bDeviceFactory.js';

export default class Zc95SerialDeviceProvider extends SerialDeviceProvider
{
    public static readonly providerName = 'zc95Serial';

    private connectedDevices: Map<string, Zc95Device> = new Map();

    private readonly deviceFactory: EStim2bDeviceFactory;

    public constructor(
        eventEmitter: EventEmitter,
        deviceFactory: Zc95DeviceFactory,
        logger: Logger
    ) {
        super(eventEmitter, logger.child({ name: Zc95SerialDeviceProvider.name }));

        this.deviceFactory = deviceFactory;
    }

    public async connectToDevice(portInfo: PortInfo): Promise<boolean> {
        const port = new SerialPort({ path: portInfo.path, baudRate: 9600, autoOpen: false });
        port.once('error', err => this.logger.error(err.message, err));

        let result;

        try {
            await new Promise<void>((resolve, reject) => {
                port.open(err => err ? reject(err) : resolve());
            });

            result = await this.connectSerialDevice(port, portInfo);
        } catch {
            result = false;
        }

        if (!result) {
            port.close();
        }

        return result;
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
                reject(new Error('Timeout waiting for statusUpdated'));
            }, 100);
        });
    }

    private async connectSerialDevice(port: SerialPort, portInfo: PortInfo): Promise<boolean> {
        const receiveQueue: MsgResponse[] = [];
        const estim2bProtocol = new EStim2bProtocol(port, new EventEmitter());


        try {
            this.logger.debug(`Ask serial device for introduction (${portInfo.serialNumber})`, portInfo);
            const status = await this.performIntroduction(estim2bProtocol);

            this.logger.info(`Module detected: E-Stim Systems 2B ${status.firmwareVersion} (${portInfo.serialNumber})`);

            const device = await this.deviceFactory.create(
                versionDetails,
                zc95Messages,
                receiveQueue,
                Zc95SerialDeviceProvider.providerName
            );

            const deviceStatusUpdaterInterval = this.initDeviceStatusUpdater(device);

            this.connectedDevices.set(device.getDeviceId, device);

            this.eventEmitter.emit(DeviceProviderEvent.deviceConnected, device);

            this.logger.debug(`Assigned device id: ${device.getDeviceId} (${portInfo.path})`);
            this.logger.info('Connected devices: ' + this.connectedDevices.size.toString());

            port.on('close', () => {
                clearInterval(deviceStatusUpdaterInterval);
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
}
