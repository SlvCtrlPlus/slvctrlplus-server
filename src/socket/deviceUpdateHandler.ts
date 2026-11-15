import type ConnectedDeviceRepository from '../repository/connectedDeviceRepository.js';
import type DeviceUpdaterInterface from '../device/updater/deviceUpdaterInterface.js';
import type { DeviceUpdateAck, DeviceUpdateData } from './types.js';
import type Logger from '../logging/Logger.js';
import { logError } from '../util/error.js';
import DeviceDataValidationError from '../device/deviceDataValidationError.js';

export default class DeviceUpdateHandler
{
    private readonly connectedDeviceRepository: ConnectedDeviceRepository;

    private readonly deviceUpdater: DeviceUpdaterInterface;

    private readonly logger: Logger;

    public constructor(
        connectedDeviceRepository: ConnectedDeviceRepository,
        deviceUpdater: DeviceUpdaterInterface,
        logger: Logger,
    ) {
        this.connectedDeviceRepository = connectedDeviceRepository;
        this.deviceUpdater = deviceUpdater;
        this.logger = logger;
    }

    public async handle(data: DeviceUpdateData, ack?: (response: DeviceUpdateAck) => void): Promise<void> {
        const deviceId = data.deviceId;
        const device = this.connectedDeviceRepository.getById(deviceId);

        if (null === device) {
            return;
        }

        try {
            const result = await this.deviceUpdater.update(device, data.data);
            ack?.(result);
        } catch (err: unknown) {
            if (err instanceof DeviceDataValidationError) {
                ack?.({ validationErrors: err.validationErrors });
                return;
            }

            logError(this.logger, `Error while updating device with id ${deviceId}`, err);
        }
    }
}
