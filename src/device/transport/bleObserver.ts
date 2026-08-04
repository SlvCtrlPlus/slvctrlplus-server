import noble, { Peripheral } from '@stoprocent/noble';
import Logger from '../../logging/Logger.js';
import DeviceManager, { DeviceDetectionInfo } from '../deviceManager.js';
import { logError } from '../../util/error.js';
import { DetectionId } from '../deviceId.js';
import SharedObserver from './sharedObserver.js';

export type BleDeviceDetectionInfo = DeviceDetectionInfo & {
    type: 'ble';
    peripheral: Peripheral;
};

export default class BleObserver extends SharedObserver
{
    private static readonly MIN_RSSI = -70;
    private static readonly UART_SERVICE_UUID = '6e400001b5a3f393e0a9e50e24dcca9e';

    private static readonly POWER_ON_WAIT_CHUNK_MS = 10 * 60 * 1000; // 10 minutes

    private readonly deviceManager: DeviceManager;

    private isScanning = false;

    private stopRequested = false;

    // Resolves the in-flight wait-for-power-on loop immediately when stop() is called, instead
    // of waiting out the rest of the current POWER_ON_WAIT_CHUNK_MS chunk.
    private cancelPowerOnWait?: () => void;

    public constructor(
        deviceManager: DeviceManager,
        logger: Logger,
    ) {
        super(logger.child({ name: BleObserver.name }));
        this.deviceManager = deviceManager;
    }

    protected async onFirstStart(): Promise<void>
    {
        this.stopRequested = false;

        noble.on('discover', this.onDiscover.bind(this));
        noble.on('scanStop', () => {
            this.logger.info('Noble scanning stopped');
        });

        // Waiting for the adapter to power on can take an arbitrarily long time (or never happen
        // at all, e.g. no BLE hardware present), so it must not block start()/stop()
        void this.startScanningOncePoweredOn();
    }

    protected async onLastStop(): Promise<void>
    {
        this.stopRequested = true;
        this.cancelPowerOnWait?.();

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
            detectionId: DetectionId.create(peripheral.id),
            peripheral,
        };

        this.deviceManager.announceDetectedDevice(deviceInfo);
    }

    private async startScanningOncePoweredOn(): Promise<void> {
        try {
            const stopped = await this.waitForPoweredOnUnlessStopped();

            if (stopped) {
                return;
            }

            await noble.startScanningAsync([BleObserver.UART_SERVICE_UUID], true);
            this.isScanning = true;

            // stop() may have run while the scan was still starting up; it then saw isScanning
            // as false and skipped stopping, so it is on us to stop the scan again
            if (this.stopRequested) {
                await noble.stopScanningAsync();
                this.isScanning = false;
                return;
            }

            this.logger.info('Looking for BLE UART devices');
        } catch (error: unknown) {
            logError(this.logger, 'BLE device discovery error', error);
            this.isScanning = false;

            try {
                await noble.stopScanningAsync();
            } catch (stopError: unknown) {
                logError(this.logger, 'Could not stop BLE scanning after a discovery error', stopError);
            }
        }
    }

    private async waitForPoweredOnUnlessStopped(): Promise<boolean> {
        let stopped = false;

        const stopSignal = new Promise<void>(resolve => {
            this.cancelPowerOnWait = (): void => {
                stopped = true;
                resolve();
            };
        });

        while (!stopped) {
            const outcome = await Promise.race([
                noble.waitForPoweredOnAsync(BleObserver.POWER_ON_WAIT_CHUNK_MS)
                    .then(() => ({ type: 'poweredOn' as const }))
                    .catch((error: unknown) => ({ type: 'notPoweredOn' as const, error })),
                stopSignal.then(() => ({ type: 'stopped' as const })),
            ]);

            if ('notPoweredOn' !== outcome.type) {
                break;
            }

            const reason = outcome.error instanceof Error ? outcome.error.message : String(outcome.error);
            this.logger.warn(`BLE adapter not powered on yet (${reason}), still waiting...`);
        }

        this.cancelPowerOnWait = undefined;

        return stopped;
    }
}
