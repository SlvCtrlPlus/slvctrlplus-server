import { SerialPort } from 'serialport';
import { PortInfo } from '@serialport/bindings-interface';
import Logger from '../../logging/Logger.js';
import DeviceManager, { DeviceDetectionInfo } from '../deviceManager.js';
import { usb } from 'usb';
import { logError } from '../../util/error.js';
import { DeviceId } from '../deviceId.js';

export type SerialDeviceDetectionInfo = DeviceDetectionInfo & {
    type: 'serial';
    portInfo: PortInfo;
};

export default class SerialPortObserver
{
    protected readonly logger: Logger;

    protected readonly deviceManager: DeviceManager;

    public static readonly name = 'serial';

    private managedDevices: Map<string, SerialDeviceDetectionInfo> = new Map();

    private onUsbEventRef?: () => void;

    private rescanTimer?: NodeJS.Timeout;

    private discoveryInFlight = false;

    /**
     * Multiple `SerialDeviceProvider`s (one per serial-based protocol, e.g. zc95, estim2b,
     * slvCtrlPlus) can be running at once and each depend on this same observer, since it's a DI
     * singleton shared across all of them. `start()`/`stop()` are reference-counted so USB
     * enumeration/listening only actually starts once (on the first caller) and only actually
     * stops once every caller that started it has also stopped it.
     */
    private activeUsers = 0;

    public constructor(
        deviceManager: DeviceManager,
        logger: Logger
    ) {
        this.deviceManager = deviceManager;
        this.logger = logger.child({ name: SerialPortObserver.name });
    }

    public async start(): Promise<void>
    {
        this.activeUsers++;

        if (this.activeUsers > 1) {
            this.logger.debug(`Already running, now used by ${this.activeUsers} provider(s)`);
            return;
        }

        await this.discoverSerialDevices();

        this.onUsbEventRef = (): void => {
            this.logger.debug('USB event detected, scanning for serial devices in 1s...');

            if (this.rescanTimer !== undefined) {
                clearTimeout(this.rescanTimer);
            }

            this.rescanTimer = setTimeout(() => {
                if (this.discoveryInFlight) {
                    return;
                }
                this.discoveryInFlight = true;
                this.discoverSerialDevices()
                    .catch(e => logError(this.logger, 'Error while scanning for new serial devices', e))
                    .finally(() => {
                        this.discoveryInFlight = false;
                    });
            }, 1000);
        };

        usb.addEventListener('connect', this.onUsbEventRef);
        usb.addEventListener('disconnect', this.onUsbEventRef);
    }

    public async discoverSerialDevices(): Promise<void>
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
                    const deviceInfo: SerialDeviceDetectionInfo = {
                        type: 'serial',
                        detectionId: DeviceId.create(portInfo.serialNumber),
                        portInfo
                    };

                    this.managedDevices.set(portInfo.serialNumber, deviceInfo);
                    this.logger.debug(`Managed devices: ${this.managedDevices.size}`);

                    this.deviceManager.announceDetectedDevice(deviceInfo);
                }
            }

            // Remove devices that are no longer present
            for (const [key, deviceInfo] of this.managedDevices) {
                if (!foundDevices.has(key)) {
                    this.deviceManager.revokeDetectedDevice(deviceInfo);
                    this.managedDevices.delete(key);
                    this.logger.info(`Managed devices: ${this.managedDevices.size}`);
                }
            }
        } catch (err) {
            logError(this.logger, 'Could not list serial ports', err);
        }
    }

    public async stop(): Promise<void> {
        if (this.activeUsers === 0) {
            return;
        }

        this.activeUsers--;

        if (this.activeUsers > 0) {
            this.logger.debug(`Still used by ${this.activeUsers} provider(s), not stopping`);
            return;
        }

        if (this.rescanTimer !== undefined) {
            clearTimeout(this.rescanTimer);
            this.rescanTimer = undefined;
        }

        if (this.onUsbEventRef !== undefined) {
            usb.removeEventListener('connect', this.onUsbEventRef);
            usb.removeEventListener('disconnect', this.onUsbEventRef);
            this.onUsbEventRef = undefined;
        }
    }
}
