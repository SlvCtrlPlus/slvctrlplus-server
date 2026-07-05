import EventEmitter from 'events';
import noble, { Peripheral } from '@stoprocent/noble';
import DeviceProvider from './deviceProvider.js';
import DeviceManager from '../deviceManager.js';
import Logger from '../../logging/Logger.js';
import { asyncHandler, promiseWithTimeout } from '../../util/async.js';
import { logError } from '../../util/error.js';
import BleDevice from '../bleDevice.js';
import { DeviceId } from '../deviceId.js';
import BleProtocolFactory from './bleProtocolFactory.js';

/**
 * Owns BLE discovery (via noble) and, for every newly discovered peripheral, tries every
 * registered protocol factory in registration order until one of them successfully connects.
 *
 * Absorbs what used to be a separate `BleObserver` transport class - since there's only ever
 * one BLE radio to scan with, there's no need for a shared broker to arbitrate between
 * independently-scanning observers/providers; this class is both the sole observer and the
 * sole consumer of what it observes.
 */
export default class BleDeviceProvider extends DeviceProvider
{
    private static readonly MIN_RSSI = -70;
    private static readonly UART_SERVICE_UUID = '6e400001b5a3f393e0a9e50e24dcca9e';

    private readonly factories: BleProtocolFactory<any>[] = [];

    private readonly connectedDevices: Set<BleDevice<any, any, any>> = new Set();

    private readonly inFlightDeviceIds: Set<string> = new Set();

    private isScanning = false;

    public constructor(deviceManager: DeviceManager, eventEmitter: EventEmitter, logger: Logger) {
        super(deviceManager, eventEmitter, logger.child({ name: BleDeviceProvider.name }));
    }

    public registerFactory(factory: BleProtocolFactory<any>): this {
        this.factories.push(factory);

        return this;
    }

    public override async init(): Promise<void> {
        noble.on('discover', asyncHandler(
            this.onDiscover.bind(this),
            (err: unknown) => logError(this.logger, 'Error in discover handler', err)
        ));

        noble.on('stateChange', asyncHandler(
            async (state) => {
                if (state === 'poweredOn') {
                    await this.observe();
                }
            },
            (err: unknown) => logError(this.logger, 'Error in stateChange handler', err)
        ));

        noble.on('scanStop', () => { this.logger.info('Noble scanning stopped'); });

        await this.observe();
    }

    public override async stop(): Promise<void> {
        noble.removeAllListeners();

        if (this.isScanning) {
            await noble.stopScanningAsync();
            this.isScanning = false;
        }

        noble.stop();

        for (const device of this.connectedDevices) {
            await device.close();
        }
        this.connectedDevices.clear();
    }

    private async observe(): Promise<void> {
        if (this.isScanning) {
            return;
        }

        try {
            // Wait for Adapter poweredOn state
            await noble.waitForPoweredOnAsync();

            this.isScanning = true;
            await noble.startScanningAsync([BleDeviceProvider.UART_SERVICE_UUID], true);

            this.logger.info('Looking for BLE UART devices');
        } catch (error: unknown) {
            logError(this.logger, 'BLE device discovery error', error);
            this.isScanning = false;
            await noble.stopScanningAsync();
        }
    }

    private async onDiscover(peripheral: Peripheral): Promise<void> {
        if (peripheral.rssi < BleDeviceProvider.MIN_RSSI) {
            // Ignore devices with very weak signal, as they are likely not in range or just noise
            this.logger.debug(`Ignoring device ${peripheral.id} with weak signal (RSSI: ${peripheral.rssi})`);
            return;
        }

        const deviceId = DeviceId.create(peripheral.id);

        if (this.inFlightDeviceIds.has(deviceId) || null !== this.deviceManager.getConnectedDevice(deviceId)) {
            // Already being attempted or already connected - ignore repeated advertisements
            return;
        }

        this.inFlightDeviceIds.add(deviceId);

        try {
            for (const factory of this.factories) {
                let device: BleDevice<any, any, any> | undefined;

                try {
                    device = await factory.tryConnect(deviceId, peripheral);
                } catch (e: unknown) {
                    logError(this.logger, `Error while connecting to BLE device via '${factory.protocolName}'`, e);
                    continue;
                }

                if (undefined === device) {
                    continue;
                }

                this.connectedDevices.add(device);
                this.deviceManager.addDevice(device);

                return;
            }

            // No registered factory recognized this peripheral's protocol
            await this.disconnectPeripheral(peripheral);
        } finally {
            this.inFlightDeviceIds.delete(deviceId);
        }
    }

    private async disconnectPeripheral(peripheral: Peripheral): Promise<void> {
        if (peripheral.state === 'connected') {
            try {
                await promiseWithTimeout(
                    peripheral.disconnectAsync(),
                    2000,
                    `Timed out while disconnecting from device ${peripheral.id}`
                );
            } catch (e: unknown) {
                logError(this.logger, `Error disconnecting peripheral ${peripheral.id}`, e);
            }
        } else if (peripheral.state === 'connecting') {
            peripheral.cancelConnect();
        }
    }
}
