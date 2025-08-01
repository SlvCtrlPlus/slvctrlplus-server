import {SerialPort} from "serialport";
import {PortInfo} from "@serialport/bindings-interface";
import Device from "../../device.js";
import EventEmitter from "events";
import Logger from "../../../logging/Logger.js";
import {Zc95Serial} from "./Zc95Serial.js";
import {Zc95Messages} from "./Zc95Messages.js";
import ListGenericDeviceAttribute from "../../attribute/listGenericDeviceAttribute.js";
import {GenericDeviceAttributeModifier} from "../../attribute/genericDeviceAttribute.js";
import SerialDeviceProvider from "../../provider/serialDeviceProvider.js";

export default class Zc95SerialDeviceProvider extends SerialDeviceProvider
{
    public static readonly name = 'zc95Serial';

    private connectedDevices: Map<string, Device> = new Map();

    public constructor(
        eventEmitter: EventEmitter,
        logger: Logger
    ) {
        super(eventEmitter, logger.child({name: 'zc95SerialDeviceProvider'}));
    }

    public async connectToDevice(portInfo: PortInfo): Promise<boolean> {
        const port = new SerialPort({path: portInfo.path, baudRate: 115200, autoOpen: false });
        port.once('error', err => this.logger.error(err.message, err));

        try {
            // Generic usb-serial device code
            await new Promise<void>((resolve, reject) => {
                port.open(err => err ? reject(err) : resolve());
            });

            return await this.connectSerialDevice(port, portInfo);
        } catch (e: unknown) {
            port.close();

            return false;
        }
    }

    private async connectSerialDevice(port: SerialPort, portInfo: PortInfo): Promise<boolean>
    {
        const zc95Serial = new Zc95Serial(port, [], true);
        const zc95Messages = new Zc95Messages(zc95Serial, true);

        try {

            this.logger.debug(`Ask serial device for introduction (${portInfo.serialNumber})`, portInfo);
            const versionDetails = await zc95Messages.getVersionDetails();
            this.logger.info(`Module detected: ZC95 ${versionDetails.ZC95} (${portInfo.serialNumber})`);

            const availablePatterns = await zc95Messages.getPatterns();

            const patternAttr = new ListGenericDeviceAttribute();
            patternAttr.name = 'pattern';
            patternAttr.values = availablePatterns.map((pattern) => pattern.Name);
            patternAttr.modifier = GenericDeviceAttributeModifier.readWrite;

            const attributes = [
                patternAttr
            ];

            console.log(attributes)

            //const device = new Zc95Device();

            /* const transport = this.deviceTransportFactory.create(zc95Serial);
            const device = await this.slvCtrlPlusDeviceFactory.create(
                result,
                transport,
                SlvCtrlPlusSerialDeviceProvider.name
            );
            const deviceStatusUpdaterInterval = this.initDeviceStatusUpdater(device);

            this.connectedDevices.set(device.getDeviceId, device);

            this.eventEmitter.emit(DeviceProviderEvent.deviceConnected, device);

            this.logger.debug(`Assigned device id: ${device.getDeviceId} (${portInfo.serialNumber})`);
            this.logger.info('Connected devices: ' + this.connectedDevices.size.toString()); */

            port.on('close', () => {
                // clearInterval(deviceStatusUpdaterInterval);
                /* this.connectedDevices.delete(device.getDeviceId);

                this.eventEmitter.emit(DeviceProviderEvent.deviceDisconnected, device);

                this.logger.info('Lost serial device: ' + device.getDeviceId); */
                this.logger.info('Connected ZC95 serial devices: ' + this.connectedDevices.size.toString());
            });

            return true;
        } catch (err: unknown) {
            this.logger.error(
                `Could not connect to serial device '${portInfo.serialNumber}': ${(err as Error).message}`,
                err
            );

            return false;
        }
    }
}
