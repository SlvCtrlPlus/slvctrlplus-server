import noble, { Peripheral } from '@stoprocent/noble';
import Logger from '../../logging/Logger.js';
import DeviceManager, { DeviceInfo } from '../deviceManager.js';
import { logError } from '../../util/error.js';
import { DeviceId } from '../deviceId.js';
import { asyncHandler } from '../../util/async.js';

export type BleDeviceInfo = DeviceInfo & {
    peripheral: Peripheral;
};

export default class BleObserver
{
    private static readonly MIN_RSSI = -70;
    private static readonly UART_SERVICE_UUID = '6e400001b5a3f393e0a9e50e24dcca9e';

    private readonly deviceManager: DeviceManager;

    private readonly logger: Logger;

    private readonly announcedDevices: Map<string, Peripheral> = new Map();

    public constructor(
        deviceManager: DeviceManager,
        logger: Logger
    ) {
        this.deviceManager = deviceManager;
        this.logger = logger.child({ name: BleObserver.name });
    }

    public async init(): Promise<void>
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

    private onDiscover(peripheral: Peripheral): void
    {
        if (peripheral.rssi < BleObserver.MIN_RSSI) {
            // Ignore devices with very weak signal, as they are likely not in range or just noise
            this.logger.debug(`Ignoring device ${peripheral.id} with weak signal (RSSI: ${peripheral.rssi})`);
            return;
        }

        const deviceInfo: BleDeviceInfo = {
            id: DeviceId.fromPath(peripheral.id),
            peripheral,
        };

        this.deviceManager.announceDetectedDevice(deviceInfo);
    }

    private async observe(): Promise<void> {
        try {
            // Wait for Adapter poweredOn state
            await noble.waitForPoweredOnAsync();

            await noble.startScanningAsync([BleObserver.UART_SERVICE_UUID], true);

            this.logger.info('Looking for BLE UART devices');
        } catch (error: unknown) {
            logError(this.logger, 'BLE device discovery error', error);
            await noble.stopScanningAsync();
        }
    }
}
