import {SerialPort} from "serialport";
import {PortInfo} from "@serialport/bindings-interface";
import EventEmitter from "events";
import Logger from "../../../logging/Logger.js";
import {Zc95Serial} from "./Zc95Serial.js";
import {MsgResponse, Zc95Messages} from "./Zc95Messages.js";
import SerialDeviceProvider from "../../provider/serialDeviceProvider.js";
import Zc95DeviceFactory from "./zc95DeviceFactory.js";
import DeviceProviderEvent from "../../provider/deviceProviderEvent.js";
import Zc95Device from "./zc95Device.js";

export default class Zc95SerialDeviceProvider extends SerialDeviceProvider
{
    public static readonly providerName = 'zc95Serial';

    private connectedDevices: Map<string, Zc95Device> = new Map();

    private readonly deviceFactory: Zc95DeviceFactory;

    public constructor(
        eventEmitter: EventEmitter,
        deviceFactory: Zc95DeviceFactory,
        logger: Logger
    ) {
        super(eventEmitter, logger.child({name: Zc95SerialDeviceProvider.name}));

        this.deviceFactory = deviceFactory;
    }

    public async connectToDevice(portInfo: PortInfo): Promise<boolean> {
        const port = new SerialPort({ path: portInfo.path, baudRate: 115200, autoOpen: false });
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

    private async connectSerialDevice(port: SerialPort, portInfo: PortInfo): Promise<boolean>
    {
        const serialLogger = this.logger.child({ name: 'zc95SerialTransport' })
        const receiveQueue: MsgResponse[] = [];
        const zc95Serial = new Zc95Serial(port, receiveQueue, serialLogger);
        const zc95Messages = new Zc95Messages(zc95Serial);

        try {
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
        } catch (err: unknown) {
            this.logger.error(
                `Could not connect to serial device '${portInfo.path}': ${(err as Error).message}`,
                err
            );

            return false;
        }
    }
}
