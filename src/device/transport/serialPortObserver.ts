import { SerialPort } from 'serialport';
import Logger from '../../logging/Logger.js';
import DeviceManager, { SerialDeviceInfo } from '../deviceManager.js';
import { asyncHandler, setIntervalAsync } from '../../util/async.js';
import { logError } from '../../util/error.js';

export default class SerialPortObserver
{
    protected readonly logger: Logger;

    protected readonly deviceManager: DeviceManager;

    public static readonly name = 'serial';

    private managedDevices: Map<string, SerialDeviceInfo> = new Map();

    public constructor(
        deviceManager: DeviceManager,
        logger: Logger
    ) {
        this.deviceManager = deviceManager;
        this.logger = logger.child({ name: SerialPortObserver.name });
    }

    public async init(): Promise<void>
    {
        return new Promise<void>((resolve) => {
            // Scan for new serial devices every 3 seconds
            setIntervalAsync(async () => await this.discoverSerialDevices(), {
                intervalMs: 3000,
                onError: (e: unknown) => logError(this.logger, 'Error while scanning for new serial devices', e),
            });
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
                    const deviceInfo: SerialDeviceInfo = {
                        id: portInfo.serialNumber,
                        portInfo
                    };

                    this.managedDevices.set(portInfo.serialNumber, deviceInfo);
                    this.logger.debug('Managed devices: ' + this.managedDevices.size.toString());

                    this.deviceManager.announceDetectedDevice(deviceInfo);
                }
            }

            // Remove devices that are no longer present
            for (const [key, deviceInfo] of this.managedDevices) {
                if (!foundDevices.has(key)) {
                    this.deviceManager.revokeDetectedDevice(deviceInfo);
                    this.managedDevices.delete(key);
                    this.logger.info('Managed devices: ' + this.managedDevices.size.toString());
                }
            }
        } catch (err) {
            this.logger.error('Could not list serial ports: ' + (err as Error).message, err);
        }
    }
}
