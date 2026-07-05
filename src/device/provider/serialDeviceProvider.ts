import DeviceProvider from './deviceProvider.js';
import EventEmitter from 'events';
import Logger from '../../logging/Logger.js';
import { BindingInterface, PortInfo } from '@serialport/bindings-interface';
import { SerialPort } from 'serialport';
import { SerialPortStream } from '@serialport/stream';
import SerialPortFactory from '../../factory/serialPortFactory.js';
import BaseError from 'modern-errors';
import DeviceManager from '../deviceManager.js';
import { logError } from '../../util/error.js';
import { usb } from 'usb';
import PeripheralDevice from '../peripheralDevice.js';
import { DeviceId } from '../deviceId.js';
import SerialProtocolFactory, { SerialDeviceInfo } from './serialProtocolFactory.js';

/**
 * Owns serial port discovery (USB list + hotplug events) and, for every newly discovered port,
 * tries every registered protocol factory in registration order until one of them successfully
 * connects.
 *
 * Absorbs what used to be a separate `SerialPortObserver` transport class. Since multiple
 * protocols compete for the same physical serial ports, connection attempts for a given port are
 * tried strictly one factory at a time (in registration order), reopening the port fresh with
 * each factory's own port settings (e.g. baud rate) between attempts.
 */
export default class SerialDeviceProvider extends DeviceProvider
{
    private readonly serialPortFactory: SerialPortFactory;

    private readonly factories: SerialProtocolFactory<any>[] = [];

    private readonly connectedDevices: Map<string, PeripheralDevice<any, any, any, any>> = new Map();

    private readonly inFlightDeviceIds: Set<string> = new Set();

    private readonly managedPortIds: Set<string> = new Set();

    private onUsbEventRef?: () => void;

    private rescanTimer?: NodeJS.Timeout;

    private discoveryInFlight = false;

    public constructor(deviceManager: DeviceManager, serialPortFactory: SerialPortFactory, eventEmitter: EventEmitter, logger: Logger) {
        super(deviceManager, eventEmitter, logger.child({ name: SerialDeviceProvider.name }));

        this.serialPortFactory = serialPortFactory;
    }

    public registerFactory(factory: SerialProtocolFactory<any>): this {
        this.factories.push(factory);

        return this;
    }

    public override async init(): Promise<void> {
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

    public async discoverSerialDevices(): Promise<void> {
        const foundPortIds: Set<string> = new Set();
        const connectAttempts: Promise<void>[] = [];

        try {
            const ports = await SerialPort.list();

            for (const portInfo of ports) {
                if (undefined === portInfo.vendorId || undefined === portInfo.productId) {
                    continue;
                }

                // If the serial number is not defined, create a "unique" one based on vendorId and productId
                if (undefined === portInfo.serialNumber) {
                    portInfo.serialNumber = `serial-${portInfo.vendorId}-${portInfo.productId}-${portInfo.locationId}`;
                }

                foundPortIds.add(portInfo.serialNumber);

                if (!this.managedPortIds.has(portInfo.serialNumber)) {
                    this.managedPortIds.add(portInfo.serialNumber);
                    this.logger.debug(`Managed devices: ${this.managedPortIds.size}`);

                    const deviceInfo: SerialDeviceInfo = { id: DeviceId.create(portInfo.serialNumber), portInfo };

                    connectAttempts.push(
                        this.attemptConnect(deviceInfo)
                            .catch((err: unknown) => logError(this.logger, `Error while connecting to serial device '${portInfo.path}'`, err))
                    );
                }
            }

            // Forget devices that are no longer present, so they can be tried again if they reappear
            for (const portId of this.managedPortIds) {
                if (!foundPortIds.has(portId)) {
                    this.managedPortIds.delete(portId);
                    this.logger.info(`Managed devices: ${this.managedPortIds.size}`);
                }
            }
        } catch (err) {
            logError(this.logger, 'Could not list serial ports', err);
        }

        await Promise.all(connectAttempts);
    }

    public override async stop(): Promise<void> {
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

    private async attemptConnect(deviceInfo: SerialDeviceInfo): Promise<void> {
        if (this.inFlightDeviceIds.has(deviceInfo.id) || null !== this.deviceManager.getConnectedDevice(deviceInfo.id)) {
            return;
        }

        this.inFlightDeviceIds.add(deviceInfo.id);

        try {
            for (const factory of this.factories) {
                let device: PeripheralDevice<any, any, any, any> | undefined;

                try {
                    device = await this.connectWithFactory(factory, deviceInfo);
                } catch (e: unknown) {
                    logError(this.logger, `Error while connecting to serial device '${deviceInfo.portInfo.path}' via '${factory.protocolName}'`, e);
                    continue;
                }

                if (undefined === device) {
                    continue;
                }

                this.connectedDevices.set(device.getDeviceId, device);
                this.deviceManager.addDevice(device);

                this.logger.debug(`Assigned device id: ${device.getDeviceId} (${deviceInfo.portInfo.path})`);
                this.logger.info(`Connected devices: ${this.connectedDevices.size}`);

                return;
            }

            this.logger.info(`Could not identify serial device '${deviceInfo.portInfo.path}': no matching protocol found`);
        } finally {
            this.inFlightDeviceIds.delete(deviceInfo.id);
        }
    }

    private async connectWithFactory(
        factory: SerialProtocolFactory<any>,
        deviceInfo: SerialDeviceInfo
    ): Promise<PeripheralDevice<any, any, any, any> | undefined> {
        const portInfo = deviceInfo.portInfo;

        this.logger.info(`Connection attempt for serial device '${portInfo.path}' via '${factory.protocolName}' (s/n: ${portInfo.serialNumber})`);

        const port = this.serialPortFactory.create({
            path: portInfo.path,
            autoOpen: false,
            ...factory.getPortOpenOptions(portInfo)
        });

        let device: PeripheralDevice<any, any, any, any> | undefined;
        let attemptFailureReason = 'unknown';

        try {
            await new Promise<void>((resolve, reject) => {
                port.open(err => err ? reject(err) : resolve());
            });

            await (factory.preparePort ?? SerialDeviceProvider.noopPreparePort)(port, portInfo);

            device = await factory.tryConnect(deviceInfo, port);
        } catch (e: unknown) {
            if (undefined !== device) {
                try {
                    await device.close();
                } catch (closeError: unknown) {
                    logError(this.logger, `Failed to close partially registered serial device '${portInfo.path}'`, closeError);
                }
            }
            const error = BaseError.normalize(e);
            attemptFailureReason = error.message;
        }

        if (undefined === device) {
            if (port.isOpen) {
                await new Promise<void>((resolve, reject) => {
                    port.close(err => err ? reject(err) : resolve());
                });
            }
            this.logger.info(`Could not connect to serial device '${portInfo.path}' via '${factory.protocolName}': ${attemptFailureReason}`);
        } else {
            this.logger.info(`Successfully connected to serial device '${portInfo.path}' via '${factory.protocolName}'`);

            const connectedDevice = device;

            port.on('close', () => {
                this.connectedDevices.delete(connectedDevice.getDeviceId);

                this.logger.info(`Lost serial device: ${connectedDevice.getDeviceId}`);
                this.logger.info(`Connected devices: ${this.connectedDevices.size}`);
            });
        }

        return device;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private static noopPreparePort(port: SerialPortStream<BindingInterface>, portInfo: PortInfo): Promise<void> {
        return Promise.resolve();
    }
}
