import {SerialPort} from "serialport";
import EventEmitter from "events";
import Logger from "../../logging/Logger.js";
import SerialDeviceProvider from "../provider/serialDeviceProvider.js";
import {PortInfo} from "@serialport/bindings-interface";

export default class SerialPortObserver
{
    protected readonly eventEmitter: EventEmitter;

    protected readonly logger: Logger;


    public static readonly name = 'serial';

    private managedDevices: Map<string, PortInfo> = new Map();

    private readonly deviceProviders: SerialDeviceProvider[] = [];

    public constructor(
        eventEmitter: EventEmitter,
        logger: Logger
    ) {
        this.logger = logger.child({name: SerialPortObserver.name});
        this.eventEmitter = eventEmitter;
    }

    public addDeviceProvider(deviceProvider: SerialDeviceProvider): void
    {
        this.deviceProviders.push(deviceProvider);
    }

    public async init(): Promise<void>
    {
        return new Promise<void>((resolve) => {
            // Scan for new SlvCtrl+ protocol serial devices every 3 seconds
            setInterval(() => { this.discoverSerialDevices().catch((e: Error) => this.logger.error(e.message, e)) }, 3000);
            resolve();
        })
    }

    private async discoverSerialDevices(): Promise<void>
    {
        const foundDevices: Map<string, null> = new Map();

        try {
            const ports = await SerialPort.list();

            // Iterate through all serial ports and add them to the managed devices and try to connect
            for (const portInfo of ports) {
                if (undefined === portInfo.vendorId || undefined === portInfo.productId) {
                    continue;
                }

                // If the serial number is not defined, create a "unique" one based on vendorId and productId
                if (undefined === portInfo.serialNumber) {
                    portInfo.serialNumber = `serial-${portInfo.vendorId}-${portInfo.productId}-${portInfo.locationId}`;
                }

                foundDevices.set(portInfo.serialNumber, null);

                if (!this.managedDevices.has(portInfo.serialNumber)) {
                    this.managedDevices.set(portInfo.serialNumber, portInfo);
                    this.logger.debug('Managed devices: ' + this.managedDevices.size.toString());

                    for (const deviceProvider of this.deviceProviders) {
                        try {
                            const result = await deviceProvider.connectToDevice(portInfo);

                            if (result) {
                                break;
                            }
                        } catch (err) {
                            this.logger.error(`Failed to initialize device provider for ${portInfo.serialNumber}: ${(err as Error).message}`, err);
                        }
                    }
                }
            }

            // Remove devices that are no longer present
            for (const [key, portInfo] of this.managedDevices) {
                if (!foundDevices.has(key)) {
                    this.eventEmitter.emit('device-lost', portInfo);
                    this.managedDevices.delete(key);
                    this.logger.info('Managed devices: ' + this.managedDevices.size.toString());
                }
            }
        } catch (err) {
            this.logger.error('Could not list serial ports: ' + (err as Error).message, err);
        }
    }
}
