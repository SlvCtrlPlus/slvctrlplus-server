import noble, { Peripheral } from '@stoprocent/noble';
import Logger from '../../logging/Logger.js';
import DeviceManager, { DeviceDetectionInfo } from '../deviceManager.js';
import { logError } from '../../util/error.js';
import { DeviceId } from '../deviceId.js';
import { asyncHandler } from '../../util/async.js';

export type BleDeviceDetectionInfo = DeviceDetectionInfo & {
    type: 'ble';
    peripheral: Peripheral;
};

export default class BleObserver
{
    private static readonly MIN_RSSI = -70;
    private static readonly UART_SERVICE_UUID = '6e400001b5a3f393e0a9e50e24dcca9e';

    private readonly deviceManager: DeviceManager;

    private readonly logger: Logger;

    private isScanning = false;

    /**
     * Multiple `BleDeviceProvider`s (one per BLE-based protocol, e.g. airotic) can be running at
     * once and each depend on this same observer, since it's a DI singleton shared across all of
     * them. `init()`/`stop()` are reference-counted so the underlying noble scan only actually
     * starts once (on the first caller) and only actually stops once every caller that started it
     * has also stopped it - two providers calling `init()` must never result in two overlapping
     * noble listener registrations, and one provider stopping must not kill scanning for another
     * still-active one.
     */
    private activeUsers = 0;

    public constructor(
        deviceManager: DeviceManager,
        logger: Logger
    ) {
        this.deviceManager = deviceManager;
        this.logger = logger.child({ name: BleObserver.name });
    }

    public async init(): Promise<void>
    {
        this.activeUsers++;

        if (this.activeUsers > 1) {
            this.logger.debug(`Already running, now used by ${this.activeUsers} provider(s)`);
            return;
        }

        noble.on('discover', this.onDiscover.bind(this));

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

    public async stop(): Promise<void>
    {
        if (this.activeUsers === 0) {
            return;
        }

        this.activeUsers--;

        if (this.activeUsers > 0) {
            this.logger.debug(`Still used by ${this.activeUsers} provider(s), not stopping`);
            return;
        }

        noble.removeAllListeners();

        if (this.isScanning) {
            await noble.stopScanningAsync();
            this.isScanning = false;
        }

        noble.stop();
    }

    private onDiscover(peripheral: Peripheral): void
    {
        if (peripheral.rssi < BleObserver.MIN_RSSI) {
            // Ignore devices with very weak signal, as they are likely not in range or just noise
            this.logger.debug(`Ignoring device ${peripheral.id} with weak signal (RSSI: ${peripheral.rssi})`);
            return;
        }

        const deviceInfo: BleDeviceDetectionInfo = {
            type: 'ble',
            detectionId: DeviceId.create(peripheral.id),
            peripheral,
        };

        this.deviceManager.announceDetectedDevice(deviceInfo);
    }

    private async observe(): Promise<void> {
        if (this.isScanning) {
            return;
        }

        try {
            // Wait for Adapter poweredOn state
            await noble.waitForPoweredOnAsync();

            this.isScanning = true;
            await noble.startScanningAsync([BleObserver.UART_SERVICE_UUID], true);

            this.logger.info('Looking for BLE UART devices');
        } catch (error: unknown) {
            logError(this.logger, 'BLE device discovery error', error);
            this.isScanning = false;
            await noble.stopScanningAsync();
        }
    }
}
