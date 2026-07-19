import noble, { Peripheral } from '@stoprocent/noble';
import Logger from '../../logging/Logger.js';
import DeviceManager, { DeviceDetectionInfo } from '../deviceManager.js';
import { logError } from '../../util/error.js';
import { DeviceId } from '../deviceId.js';
import { asyncHandler } from '../../util/async.js';
import SharedObserver from './sharedObserver.js';

export type BleDeviceDetectionInfo = DeviceDetectionInfo & {
    type: 'ble';
    peripheral: Peripheral;
};

export default class BleObserver extends SharedObserver
{
    private static readonly MIN_RSSI = -70;
    private static readonly UART_SERVICE_UUID = '6e400001b5a3f393e0a9e50e24dcca9e';

    private readonly deviceManager: DeviceManager;

    private isScanning = false;

    public constructor(
        deviceManager: DeviceManager,
        logger: Logger
    ) {
        super(logger.child({ name: BleObserver.name }));
        this.deviceManager = deviceManager;
    }

    public async init(): Promise<void>
    {
        await this.acquire();
    }

    public async stop(): Promise<void>
    {
        await this.release();
    }

    protected async onFirstStart(): Promise<void>
    {
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

    protected async onLastStop(): Promise<void>
    {
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
