import { SerialPort } from 'serialport';
import { PortInfo } from '@serialport/bindings-interface';
import Logger from '../../logging/Logger.js';
import DeviceManager, { DeviceDetectionInfo } from '../deviceManager.js';
import { usb } from 'usb';
import { logError } from '../../util/error.js';
import { DetectionId } from '../deviceId.js';
import SharedObserver from './sharedObserver.js';
import { CancellationToken, cancellationTokenReasons } from '@timesplinter/sequential-task-queue';
import LatestOnlyTaskQueue from '../../util/latestOnlyTaskQueue.js';

export type SerialDeviceDetectionInfo = DeviceDetectionInfo & {
    type: 'serial';
    portInfo: PortInfo;
};

export default class SerialPortObserver extends SharedObserver
{
    protected readonly deviceManager: DeviceManager;

    private managedDevices = new Map<string, SerialDeviceDetectionInfo>();

    private onUsbEventRef?: () => void;

    private rescanTimer?: NodeJS.Timeout;

    private readonly discoveryQueue = new LatestOnlyTaskQueue<void>();

    public constructor(
        deviceManager: DeviceManager,
        logger: Logger
    ) {
        super(logger.child({ name: SerialPortObserver.name }));
        this.deviceManager = deviceManager;
    }

    protected async onFirstStart(): Promise<void>
    {
        await this.discoverSerialDevices();

        this.onUsbEventRef = (): void => {
            if (this.rescanTimer === undefined) {
                this.logger.debug('USB event detected, scanning for serial devices in 1s...');
            } else {
                clearTimeout(this.rescanTimer);
            }

            this.rescanTimer = setTimeout(() => {
                this.rescanTimer = undefined;

                this.discoveryQueue.run((cancellationToken) => this.discoverSerialDevices(cancellationToken))
                    .catch((e: unknown) => {
                        if (e === cancellationTokenReasons.cancel) {
                            this.logger.debug('Serial device discovery run cancelled (superseded by a later run or stopped)');
                        } else {
                            logError(this.logger, 'Error while scanning for new serial devices', e);
                        }
                    });
            }, 1000);
        };

        usb.addEventListener('connect', this.onUsbEventRef);
        usb.addEventListener('disconnect', this.onUsbEventRef);
    }

    /**
     * Gives a provider that just joined an already-running observer a chance at devices detected
     * before it subscribed - discoverSerialDevices() itself only announces newly-discovered
     * ports, so a device already sitting unclaimed here (e.g. because no provider wanted it yet)
     * would otherwise never be offered to this provider.
     */
    protected override async onSubsequentStart(): Promise<void>
    {
        // announceDetectedDevice() itself is a no-op for a device that's already connected, so
        // there's no need to filter those out here first.
        for (const deviceInfo of this.managedDevices.values()) {
            this.deviceManager.announceDetectedDevice(deviceInfo);
        }
    }

    public async discoverSerialDevices(cancellationToken?: CancellationToken): Promise<void>
    {
        const foundDevices = new Map<string, null>();
        let ports: PortInfo[];

        try {
            ports = await SerialPort.list();
        } catch (err) {
            logError(this.logger, 'Could not list serial ports', err);
            return;
        }

        if (true === cancellationToken?.cancelled) {
            // Superseded by a later discovery run, or the observer was stopped
            return;
        }

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
                    detectionId: DetectionId.create(portInfo.serialNumber),
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
    }

    protected async onLastStop(): Promise<void> {
        if (this.rescanTimer !== undefined) {
            clearTimeout(this.rescanTimer);
            this.rescanTimer = undefined;
        }

        if (this.onUsbEventRef !== undefined) {
            usb.removeEventListener('connect', this.onUsbEventRef);
            usb.removeEventListener('disconnect', this.onUsbEventRef);
            this.onUsbEventRef = undefined;
        }

        // Cancels a discovery run that's still awaiting SerialPort.list(), so it can't write
        // stale results back into managedDevices below once it settles
        await this.discoveryQueue.cancel();

        for (const deviceInfo of this.managedDevices.values()) {
            this.deviceManager.revokeDetectedDevice(deviceInfo);
        }

        this.managedDevices.clear();
    }
}
