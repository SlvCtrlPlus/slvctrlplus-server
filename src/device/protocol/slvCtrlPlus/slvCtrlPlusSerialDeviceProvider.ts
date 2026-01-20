import { ReadlineParser, ReadyParser, SerialPort } from 'serialport';
import type { PortInfo } from '@serialport/bindings-interface';
import Device from '../../device.js';
import SlvCtrlPlusDeviceFactory from './slvCtrlPlusDeviceFactory.js';
import SynchronousSerialPort from '../../../serial/SynchronousSerialPort.js';
import EventEmitter from 'events';
import SerialDeviceTransportFactory from '../../transport/serialDeviceTransportFactory.js';
import DeviceProviderEvent from '../../provider/deviceProviderEvent.js';
import Logger from '../../../logging/Logger.js';
import SerialDeviceProvider, { SerialDeviceProviderPortOpenOptions } from '../../provider/serialDeviceProvider.js';
import SerialPortFactory from '../../../factory/serialPortFactory.js';
import { clearInterval } from 'node:timers';
import { DeviceInfo } from './slvCtrlPlusDevice.js';

export default class SlvCtrlPlusSerialDeviceProvider extends SerialDeviceProvider
{
    public static readonly providerName = 'slvCtrlPlusSerial';

    private static readonly moduleReadyByte = 0x07;

    private static readonly arduinoVendorId = '2341';

    private connectedDevices: Map<string, Device> = new Map();

    private readonly slvCtrlPlusDeviceFactory: SlvCtrlPlusDeviceFactory;

    private readonly deviceTransportFactory: SerialDeviceTransportFactory;

    public constructor(
        serialPortFactory: SerialPortFactory,
        eventEmitter: EventEmitter,
        deviceFactory: SlvCtrlPlusDeviceFactory,
        deviceTransportFactory: SerialDeviceTransportFactory,
        logger: Logger
    ) {
        super(serialPortFactory, eventEmitter, logger.child({ name: SlvCtrlPlusSerialDeviceProvider.name }));
        this.slvCtrlPlusDeviceFactory = deviceFactory;
        this.deviceTransportFactory = deviceTransportFactory;
    }

    protected async connectSerialDevice(port: SerialPort, portInfo: PortInfo): Promise<boolean> {
        const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
        const syncPort = new SynchronousSerialPort(portInfo, parser, port, this.logger);

        await syncPort.writeAndExpect('clear\n', 250);
        const result = await syncPort.writeAndExpect('introduce\n', 250);

        const deviceInfo = this.parseDeviceInfo(result);

        if (undefined === deviceInfo) {
            throw new Error(`Could not obtain device information from 'introduce' command response`);
        }

        this.logger.info(`Module detected: ${result} (${portInfo.serialNumber})`);

        const transport = this.deviceTransportFactory.create(syncPort);
        const device = await this.slvCtrlPlusDeviceFactory.create(
            deviceInfo,
            transport,
            SlvCtrlPlusSerialDeviceProvider.providerName
        );
        const deviceStatusUpdaterInterval = this.initDeviceStatusUpdater(device);

        this.connectedDevices.set(device.getDeviceId, device);

        this.eventEmitter.emit(DeviceProviderEvent.deviceConnected, device);

        this.logger.debug(`Assigned device id: ${device.getDeviceId} (${portInfo.serialNumber})`);
        this.logger.info('Connected devices: ' + this.connectedDevices.size.toString());

        port.on('close', () => {
            clearInterval(deviceStatusUpdaterInterval);
            this.connectedDevices.delete(device.getDeviceId);

            this.eventEmitter.emit(DeviceProviderEvent.deviceDisconnected, device);

            this.logger.info('Lost serial device: ' + device.getDeviceId);
            this.logger.info('Connected SlvCtrl+ serial devices: ' + this.connectedDevices.size.toString());
        });

        return true;
    }

    protected parseDeviceInfo(introductionResult: string): DeviceInfo | undefined {
        const parts = introductionResult.split(';');

        if ('introduce' !== parts[0]) {
            return undefined;
        }

        const deviceInfoParts = parts[1].split(',');

        if (deviceInfoParts.length !== 3) {
            return undefined;
        }

        const deviceType = deviceInfoParts[0];
        const fwVersion = parseInt(deviceInfoParts[1], 10);
        const protocolVersion = parseInt(deviceInfoParts[2], 10);

        if (isNaN(fwVersion) || isNaN(protocolVersion)) {
            return undefined;
        }

        return { deviceType, fwVersion, protocolVersion };
    }

    protected getSerialDeviceProviderPortOpenOptions(): SerialDeviceProviderPortOpenOptions {
        return { baudRate: 9600 };
    }

    protected preparePort(port: SerialPort, portInfo: PortInfo): Promise<void> {
        return new Promise<void>(((resolve, reject) => {
            if (portInfo.vendorId !== SlvCtrlPlusSerialDeviceProvider.arduinoVendorId) {
                // It's NOT an Arduino
                resolve();
                return;
            }

            const readyParser = port.pipe(new ReadyParser({
                delimiter: [SlvCtrlPlusSerialDeviceProvider.moduleReadyByte]
            }));

            // Let's timeout if we don't receive the ready bytes for a few seconds
            const timeout = setTimeout(() => {
                port.unpipe(readyParser);
                readyParser.destroy();
                reject(new Error(`Timed out while waiting for ready bytes`));
            }, 3000);

            readyParser.once('ready', () => {
                clearTimeout(timeout);
                port.unpipe(readyParser);
                readyParser.destroy();
                resolve();
            });
        });
    }
}
