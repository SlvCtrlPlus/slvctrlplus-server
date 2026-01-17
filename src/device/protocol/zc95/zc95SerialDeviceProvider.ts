import { SerialPort } from 'serialport';
import { PortInfo } from '@serialport/bindings-interface';
import EventEmitter from 'events';
import Logger from '../../../logging/Logger.js';
import { Zc95Serial } from './Zc95Serial.js';
import { MsgResponse, Zc95Messages } from './Zc95Messages.js';
import SerialDeviceProvider, { SerialDeviceProviderPortOpenOptions } from '../../provider/serialDeviceProvider.js';
import Zc95DeviceFactory from './zc95DeviceFactory.js';
import DeviceProviderEvent from '../../provider/deviceProviderEvent.js';
import Zc95Device from './zc95Device.js';
import SerialPortFactory from '../../provider/serialPortFactory.js';

export default class Zc95SerialDeviceProvider extends SerialDeviceProvider
{
    public static readonly providerName = 'zc95Serial';

    private connectedDevices: Map<string, Zc95Device> = new Map();

    private readonly deviceFactory: Zc95DeviceFactory;

    public constructor(
        serialPortFactory: SerialPortFactory,
        eventEmitter: EventEmitter,
        deviceFactory: Zc95DeviceFactory,
        logger: Logger
    ) {
        super(serialPortFactory, eventEmitter, logger.child({ name: Zc95SerialDeviceProvider.name }));

        this.deviceFactory = deviceFactory;
    }

    protected async connectSerialDevice(port: SerialPort, portInfo: PortInfo): Promise<boolean> {
        const serialLogger = this.logger.child({ name: Zc95Serial.name })
        const receiveQueue: MsgResponse[] = [];
        const zc95Serial = new Zc95Serial(port, receiveQueue, serialLogger);
        const zc95Messages = new Zc95Messages(zc95Serial);

        this.logger.debug(`Reset connection to ZC95 device`);
        await zc95Serial.reset(false);
        this.logger.debug(`Ask serial device for introduction (${portInfo.serialNumber})`, portInfo);
        const versionDetails = await zc95Messages.getVersionDetails();

        if (undefined === versionDetails) {
            throw new Error(`Could not obtain version details`);
        }

        this.logger.info(`Module detected: ZC95 ${versionDetails.ZC95} (${portInfo.serialNumber})`);

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
    }

    protected getSerialDeviceProviderPortOpenOptions(): SerialDeviceProviderPortOpenOptions {
        return { baudRate: 115200 };
    }
}
